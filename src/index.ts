import './style.css';
import settingsHtml from './settings.html';
import {
    BackendId,
    DEFAULT_NEGATIVE,
    DEFAULT_SETTINGS,
    DEFAULT_STYLE_SUFFIX,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_SYSTEM_PROMPT_H3,
    H3_MODEL_PATTERN,
    MODEL_SUGGESTIONS,
    PromptFormat,
    SceneVideoSettings,
} from './defaults';
import { generateVideo, getPluginStatus, listComfyWorkflows, PLUGIN_BASE, saveWaveSpeedKey } from './backends';

/* eslint-disable @typescript-eslint/no-explicit-any */

const MODULE = 'scene_video';
const BUTTON_CLASS = 'scene_video_gen';
const ctx = () => SillyTavern.getContext();

/** Message id -> abort controller of the running generation. */
const running = new Map<number, AbortController>();

// ---------- settings ----------

function settings(): SceneVideoSettings {
    const all = ctx().extensionSettings;
    const current = all[MODULE] ?? {};
    // Deep-merge defaults so new fields appear after updates.
    all[MODULE] = {
        ...structuredClone(DEFAULT_SETTINGS),
        ...current,
        backends: {
            openrouter: { ...DEFAULT_SETTINGS.backends.openrouter, ...current.backends?.openrouter },
            wavespeed: { ...DEFAULT_SETTINGS.backends.wavespeed, ...current.backends?.wavespeed },
        },
    };
    return all[MODULE];
}

const save = () => ctx().saveSettingsDebounced();

// ---------- prompt building ----------

function cleanText(text: string): string {
    return String(text ?? '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildSceneContext(messageId: number, s: SceneVideoSettings): string {
    const c = ctx();
    const parts: string[] = [];

    try {
        const fields = c.getCharacterCardFields?.() ?? {};
        if (fields.description) parts.push(`[Character "${c.name2}" description]\n${truncate(cleanText(c.substituteParams(fields.description)), 2500)}`);
        if (fields.persona) parts.push(`[User "${c.name1}" description]\n${truncate(cleanText(c.substituteParams(fields.persona)), 1000)}`);
        if (fields.scenario) parts.push(`[Scenario]\n${truncate(cleanText(c.substituteParams(fields.scenario)), 1000)}`);
    } catch (error) {
        console.warn('[Scene Video] Could not read character card fields', error);
    }

    const history: string[] = [];
    for (let i = Math.max(0, messageId - s.contextMessages); i < messageId; i++) {
        const m = c.chat[i];
        if (!m || m.is_system) continue;
        history.push(`${m.name}: ${truncate(cleanText(m.mes), 1500)}`);
    }
    if (history.length) parts.push(`[Earlier messages]\n${history.join('\n\n')}`);

    const target = c.chat[messageId];
    parts.push(`[LAST message — film this moment]\n${target.name}: ${truncate(cleanText(target.mes), 4000)}`);
    return parts.join('\n\n');
}

/** Resolves `auto` to a concrete format based on the selected backend and model. */
export function resolvePromptFormat(s: SceneVideoSettings): Exclude<PromptFormat, 'auto'> {
    if (s.promptFormat !== 'auto') return s.promptFormat;
    if (s.backend === 'comfy') return 'generic';
    return H3_MODEL_PATTERN.test(s.backends[s.backend].model) ? 'minimax-h3' : 'generic';
}

/** Light cleanup of LLM output that keeps markup such as H3's <d> tags. */
function cleanLlmOutput(raw: string): string {
    return String(raw ?? '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^\s*```[\w-]*\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
}

/** Cuts any preamble before the first field and fills in missing trailing fields. */
function normalizeH3Prompt(text: string): string {
    // LLMs sometimes bold the field names.
    let out = text.replace(/\*\*(integrated_multimodal_description|overall_soundscape|non_diegetic_music)\*\*\s*:?/g, '$1:');
    const start = out.indexOf('integrated_multimodal_description:');
    if (start === -1) {
        throw new Error('The LLM response is missing "integrated_multimodal_description:". Edit the prompt or try again.');
    }
    out = out.slice(start).trim();
    if (!out.includes('overall_soundscape:')) {
        console.warn('[Scene Video] The H3 prompt has no overall_soundscape field');
    }
    if (!out.includes('non_diegetic_music:')) {
        out += '\n\nnon_diegetic_music: N/A';
    }
    return out;
}

function applyTemplate(template: string, s: SceneVideoSettings): string {
    return template
        .replaceAll('{{seconds}}', String(s.seconds))
        .replaceAll('{{aspect}}', s.aspect)
        .replaceAll('{{style}}', s.styleSuffix.trim() || 'Realistic live-action footage.');
}

async function writeVideoPrompt(messageId: number, s: SceneVideoSettings): Promise<string> {
    const c = ctx();
    const format = resolvePromptFormat(s);
    const template = format === 'minimax-h3' ? s.systemPromptH3 : s.systemPrompt;
    const raw = await c.generateRaw({
        systemPrompt: applyTemplate(template, s),
        prompt: `${buildSceneContext(messageId, s)}\n\nWrite the video prompt now.`,
        responseLength: s.responseLength,
    });

    const text = cleanLlmOutput(raw);
    if (!text) throw new Error('The LLM returned an empty video prompt.');
    if (format === 'minimax-h3') return normalizeH3Prompt(text);
    return cleanText(text).replace(/^["'«]|["'»]$/g, '').replace(/^(video )?prompt:\s*/i, '').trim();
}

/** The generic format gets the style suffix appended. H3 has the style inside [Shot 1]. */
function buildFinalPrompt(prompt: string, s: SceneVideoSettings): string {
    if (resolvePromptFormat(s) === 'minimax-h3') return prompt;
    return s.styleSuffix.trim() ? `${prompt}\n\n${s.styleSuffix.trim()}` : prompt;
}

// ---------- media ----------

async function uploadVideo(base64: string, format: string): Promise<string> {
    const c = ctx();
    const folder = c.groupId ? (c.groups.find((g: any) => g.id === c.groupId)?.name ?? 'group') : (c.name2 || 'scene-video');
    const res = await fetch('/api/images/upload', {
        method: 'POST',
        headers: c.getRequestHeaders(),
        body: JSON.stringify({
            image: base64,
            format: format || 'mp4',
            ch_name: folder,
            filename: `scene_${c.humanizedDateTime()}`.replace(/[^\w-]+/g, '_'),
        }),
    });
    if (!res.ok) throw new Error(`Saving the video failed: ${await res.text()}`);
    return (await res.json()).path;
}

function attachVideo(messageId: number, url: string, prompt: string) {
    const c = ctx();
    const message = c.chat[messageId];
    if (!message.extra || typeof message.extra !== 'object') message.extra = {};
    c.ensureMessageMediaIsArray?.(message);
    if (!Array.isArray(message.extra.media)) message.extra.media = [];
    if (!message.extra.media.length && !message.extra.media_display) message.extra.media_display = 'gallery';

    message.extra.media.push({ url, type: 'video', title: prompt, source: 'generated' });
    message.extra.media_index = message.extra.media.length - 1;
    message.extra.inline_image = true;

    const element = $(`#chat .mes[mesid="${messageId}"]`);
    c.appendMediaToMessage(message, element);
}

// ---------- main flow ----------

function setBusy(messageId: number, busy: boolean) {
    $(`#chat .mes[mesid="${messageId}"] .${BUTTON_CLASS}`).toggleClass('scene-video-busy', busy);
}

interface RunOptions {
    /** Ready prompt; skips the LLM step. */
    prompt?: string;
    /** Skip the review popup. */
    quiet?: boolean;
}

export async function generateSceneVideo(messageId: number, opts: RunOptions = {}): Promise<string> {
    const c = ctx();
    const s = settings();
    const message = c.chat[messageId];
    if (!message) throw new Error(`Message #${messageId} not found`);
    if (running.has(messageId)) throw new Error('A video is already being generated for this message.');

    const controller = new AbortController();
    running.set(messageId, controller);
    setBusy(messageId, true);
    const chatId = c.getCurrentChatId();
    let toast: any = null;

    try {
        let prompt = opts.prompt?.trim();
        if (!prompt) {
            toast = toastr.info('Writing the video prompt…', 'Scene Video', { timeOut: 0, extendedTimeOut: 0 });
            prompt = await writeVideoPrompt(messageId, s);
            toastr.clear(toast);
        }

        const isH3 = resolvePromptFormat(s) === 'minimax-h3';
        if (s.confirmPrompt && !opts.quiet) {
            const note = isH3
                ? 'MiniMax H3 structured format. Keep the three fields and the <code>&lt;d&gt;</code> tags.'
                : 'The style suffix is added automatically.';
            const edited = await c.Popup.show.input(
                'Video prompt',
                `${note} Backend: <b>${s.backend}</b>`,
                prompt,
                { rows: isH3 ? 18 : 10, okButton: 'Generate', cancelButton: 'Cancel', wide: true },
            );
            if (edited === null || edited === undefined || !String(edited).trim()) {
                return '';
            }
            prompt = String(edited).trim();
        }

        const finalPrompt = buildFinalPrompt(prompt, s);
        toast = toastr.info('Generating the video. This usually takes 1–5 minutes.', 'Scene Video', { timeOut: 0, extendedTimeOut: 0 });

        const video = await generateVideo({ prompt: finalPrompt, negative: s.negativePrompt, settings: s, signal: controller.signal });
        const url = await uploadVideo(video.data, video.format);
        toastr.clear(toast);

        if (c.getCurrentChatId() !== chatId || ctx().chat[messageId] !== message) {
            toastr.warning(`The chat changed during generation. The video was saved here: ${url}`, 'Scene Video');
            return url;
        }

        attachVideo(messageId, url, prompt);
        await c.saveChat();
        toastr.success('The video was added to the message.', 'Scene Video');
        return url;
    } catch (error: any) {
        if (toast) toastr.clear(toast);
        if (controller.signal.aborted) {
            toastr.info('Video generation was cancelled.', 'Scene Video');
            return '';
        }
        console.error('[Scene Video]', error);
        toastr.error(String(error?.message ?? error), 'Scene Video failed', { timeOut: 15000 });
        throw error;
    } finally {
        running.delete(messageId);
        setBusy(messageId, false);
    }
}

async function onButtonClick(this: HTMLElement) {
    const messageId = Number($(this).closest('.mes').attr('mesid'));
    if (Number.isNaN(messageId)) return;

    const active = running.get(messageId);
    if (active) {
        const ok = await ctx().Popup.show.confirm('Scene Video', 'Cancel the video generation for this message?');
        if (ok) active.abort();
        return;
    }
    generateSceneVideo(messageId).catch(() => { /* already reported */ });
}

// ---------- message button ----------

const BUTTON_HTML = `<div title="Generate scene video" class="mes_button ${BUTTON_CLASS} fa-solid fa-video" data-i18n="[title]Generate scene video"></div>`;

function syncButtons() {
    const show = settings().enabled;
    const targets = $('#message_template .extraMesButtons, #chat .mes .extraMesButtons');
    targets.each(function (this: HTMLElement) {
        const el = $(this);
        const has = el.find(`.${BUTTON_CLASS}`).length > 0;
        if (show && !has) el.prepend(BUTTON_HTML);
        if (!show && has) el.find(`.${BUTTON_CLASS}`).remove();
    });
}

// ---------- settings UI ----------

async function refreshPluginStatus() {
    const s = settings();
    const el = $('#scene_video_plugin_status');
    if (s.backend === 'comfy') {
        el.text('ComfyUI is called through SillyTavern; no plugin needed.');
        return;
    }
    const status = await getPluginStatus();
    if (!status) {
        el.html('⚠️ The server plugin is not loaded. See the README: copy <code>server/</code> to <code>SillyTavern/plugins/scene-video</code> and set <code>enableServerPlugins: true</code>.');
        return;
    }
    const hasKey = s.backend === 'openrouter' ? status.openrouter : status.wavespeed;
    el.text(hasKey ? '✅ The plugin is loaded and the API key is set.' : '⚠️ The plugin is loaded, but the API key for this backend is missing.');
}

async function refreshComfyWorkflows() {
    const s = settings();
    const list = await listComfyWorkflows();
    const select = $('#scene_video_comfy_workflow').empty();
    select.append('<option value="">— select —</option>');
    for (const name of list) {
        select.append($('<option></option>').val(name).text(name));
    }
    select.val(s.comfyWorkflow);
}

function renderBackendSection() {
    const s = settings();
    const b = s.backend;
    $('.scene-video-cloud').toggle(b !== 'comfy');
    $('.scene-video-openrouter').toggle(b === 'openrouter');
    $('.scene-video-wavespeed').toggle(b === 'wavespeed');
    $('.scene-video-comfy').toggle(b === 'comfy');

    if (b !== 'comfy') {
        const cfg = s.backends[b];
        $('#scene_video_model').val(cfg.model);
        $('#scene_video_resolution').val(cfg.resolution);
        $('#scene_video_extra').val(cfg.extra);
        const list = $('#scene_video_models').empty();
        for (const m of MODEL_SUGGESTIONS[b]) list.append($('<option></option>').val(m));
    } else {
        refreshComfyWorkflows();
    }
    refreshPluginStatus();
    renderPromptFormat();
}

function renderPromptFormat() {
    const s = settings();
    const resolved = resolvePromptFormat(s);
    $('#scene_video_system_generic_block').toggle(resolved === 'generic');
    $('#scene_video_system_h3_block').toggle(resolved === 'minimax-h3');
    $('#scene_video_format_status').text(s.promptFormat === 'auto'
        ? `Active: ${resolved === 'minimax-h3' ? 'MiniMax H3' : 'generic'}`
        : '');
}

function bindInput(selector: string, apply: (value: string, checked: boolean) => void) {
    $(selector).on('input change', function (this: HTMLInputElement) {
        apply(String($(this).val() ?? ''), Boolean(this.checked));
        save();
    });
}

function cloudCfg() {
    const s = settings();
    return s.backends[s.backend as 'openrouter' | 'wavespeed'];
}

function escapeHtml(text: unknown): string {
    return String(text ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
}

async function showOpenRouterModels() {
    try {
        const res = await fetch(`${PLUGIN_BASE}/openrouter/models`, { method: 'POST', headers: ctx().getRequestHeaders() });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const models: any[] = data.data ?? data;
        const rows = models.map(m => {
            const price = m.pricing_skus?.duration_seconds ? `$${m.pricing_skus.duration_seconds}/s` : '';
            const durations = Array.isArray(m.supported_durations) && m.supported_durations.length
                ? `${Math.min(...m.supported_durations)}–${Math.max(...m.supported_durations)}s` : '';
            const audio = m.generate_audio ? '🔊' : '';
            const resolutions = (m.supported_resolutions ?? []).join(', ');
            return `<tr><td><code>${escapeHtml(m.id)}</code></td><td>${durations}</td><td>${escapeHtml(resolutions)}</td><td>${escapeHtml(price)}</td><td>${audio}</td></tr>`;
        }).join('');
        await ctx().Popup.show.text('OpenRouter video models', `<table class="scene-video-models"><tr><th>id</th><th>duration</th><th>resolution</th><th>price</th><th>audio</th></tr>${rows}</table>`, { wide: true, allowVerticalScrolling: true });
    } catch (error: any) {
        toastr.error(String(error?.message ?? error), 'Scene Video');
    }
}

function initSettingsUI() {
    const s = settings();
    const container = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
    container.append(settingsHtml);

    $('#scene_video_enabled').prop('checked', s.enabled);
    $('#scene_video_confirm').prop('checked', s.confirmPrompt);
    $('#scene_video_auto').prop('checked', s.autoGenerate);
    $('#scene_video_backend').val(s.backend);
    $('#scene_video_audio').prop('checked', s.audio);
    $('#scene_video_comfy_url').val(s.comfyUrl);
    $('#scene_video_comfy_fps').val(s.comfyFps);
    $('#scene_video_seconds').val(s.seconds);
    $('#scene_video_aspect').val(s.aspect);
    $('#scene_video_context').val(s.contextMessages);
    $('#scene_video_response_length').val(s.responseLength);
    $('#scene_video_system').val(s.systemPrompt);
    $('#scene_video_format').val(s.promptFormat);
    $('#scene_video_system_h3').val(s.systemPromptH3);
    $('#scene_video_style').val(s.styleSuffix);
    $('#scene_video_negative').val(s.negativePrompt);

    bindInput('#scene_video_enabled', (_v, c) => { settings().enabled = c; syncButtons(); });
    bindInput('#scene_video_confirm', (_v, c) => { settings().confirmPrompt = c; });
    bindInput('#scene_video_auto', (_v, c) => { settings().autoGenerate = c; });
    $('#scene_video_backend').on('change', function (this: HTMLSelectElement) {
        settings().backend = this.value as BackendId;
        save();
        renderBackendSection();
    });
    bindInput('#scene_video_model', v => { cloudCfg().model = v.trim(); renderPromptFormat(); });
    bindInput('#scene_video_format', v => { settings().promptFormat = v as PromptFormat; renderPromptFormat(); });
    bindInput('#scene_video_system_h3', v => { settings().systemPromptH3 = v; });
    bindInput('#scene_video_resolution', v => { cloudCfg().resolution = v.trim(); });
    bindInput('#scene_video_extra', v => { cloudCfg().extra = v; });
    bindInput('#scene_video_audio', (_v, c) => { settings().audio = c; });
    bindInput('#scene_video_comfy_url', v => { settings().comfyUrl = v.trim(); });
    bindInput('#scene_video_comfy_workflow', v => { settings().comfyWorkflow = v; });
    bindInput('#scene_video_comfy_fps', v => { settings().comfyFps = Number(v) || 24; });
    bindInput('#scene_video_seconds', v => { settings().seconds = Number(v) || DEFAULT_SETTINGS.seconds; });
    bindInput('#scene_video_aspect', v => { settings().aspect = v as SceneVideoSettings['aspect']; });
    bindInput('#scene_video_context', v => { settings().contextMessages = Math.max(0, Number(v) || 0); });
    bindInput('#scene_video_response_length', v => { settings().responseLength = Number(v) || DEFAULT_SETTINGS.responseLength; });
    bindInput('#scene_video_system', v => { settings().systemPrompt = v; });
    bindInput('#scene_video_style', v => { settings().styleSuffix = v; });
    bindInput('#scene_video_negative', v => { settings().negativePrompt = v; });

    $('#scene_video_comfy_refresh').on('click', refreshComfyWorkflows);
    $('#scene_video_or_models').on('click', showOpenRouterModels);
    $('#scene_video_ws_key_save').on('click', async () => {
        const value = String($('#scene_video_ws_key').val() ?? '').trim();
        if (!value) return;
        try {
            await saveWaveSpeedKey(value);
            $('#scene_video_ws_key').val('');
            toastr.success('The WaveSpeed key was saved.', 'Scene Video');
            refreshPluginStatus();
        } catch (error: any) {
            toastr.error(String(error?.message ?? error), 'Scene Video');
        }
    });
    $('#scene_video_reset_prompts').on('click', () => {
        const st = settings();
        st.systemPrompt = DEFAULT_SYSTEM_PROMPT;
        st.systemPromptH3 = DEFAULT_SYSTEM_PROMPT_H3;
        st.styleSuffix = DEFAULT_STYLE_SUFFIX;
        st.negativePrompt = DEFAULT_NEGATIVE;
        $('#scene_video_system').val(st.systemPrompt);
        $('#scene_video_system_h3').val(st.systemPromptH3);
        $('#scene_video_style').val(st.styleSuffix);
        $('#scene_video_negative').val(st.negativePrompt);
        save();
    });

    renderBackendSection();
}

// ---------- slash command ----------

function registerSlashCommand() {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, SlashCommandNamedArgument } = ctx();
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'scenevideo',
        aliases: ['svideo'],
        returns: 'URL of the saved video',
        callback: async (args: any, value: string) => {
            const chat = ctx().chat;
            const id = String(value ?? '').trim() === '' ? chat.length - 1 : Number(value);
            return await generateSceneVideo(id, {
                prompt: args.prompt ? String(args.prompt) : undefined,
                quiet: String(args.quiet) === 'true',
            });
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({ name: 'prompt', description: 'Ready video prompt (skips the LLM step)', typeList: ['string'] }),
            SlashCommandNamedArgument.fromProps({ name: 'quiet', description: 'Skip the prompt review popup', typeList: ['bool'], defaultValue: 'false' }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({ description: 'Message id (defaults to the last message)', typeList: ['number'] }),
        ],
        helpString: 'Generates a short smartphone-style video of the scene from a message and attaches it to that message.',
    }));
}

// ---------- init ----------

function init() {
    const c = ctx();
    settings();
    initSettingsUI();
    syncButtons();
    registerSlashCommand();

    $(document).on('click', `.${BUTTON_CLASS}`, onButtonClick);

    c.eventSource.on(c.eventTypes.CHAT_CHANGED, () => syncButtons());
    c.eventSource.on(c.eventTypes.CHARACTER_MESSAGE_RENDERED, (messageId: number, type: string) => {
        syncButtons();
        const s = settings();
        if (!s.autoGenerate || type === 'extension' || type === 'first_message') return;
        const message = ctx().chat[messageId];
        if (!message || message.is_user || message.is_system) return;
        generateSceneVideo(Number(messageId)).catch(() => { /* already reported */ });
    });
}

init();
