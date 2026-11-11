import './style.css';
import settingsHtml from './settings.html';
import {
    Aspect,
    AUDIO_MODES,
    AudioMode,
    BackendId,
    CAMERA_MODES,
    CameraMode,
    DEFAULT_SETTINGS,
    DEFAULT_SYSTEM_PROMPT,
    defaultLooks,
    DEFAULT_SYSTEM_PROMPT_H3,
    H3_MODEL_PATTERN,
    LEGACY_NEGATIVE_HASHES,
    LEGACY_PROMPT_HASHES,
    MODEL_SUGGESTIONS,
    PromptFormat,
    promptHash,
    PLAN_INSTRUCTION,
    PROMPTS_VERSION,
    SceneVideoSettings,
    ShotMode,
    shotRule,
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
    migrateLegacyFields(current);
    // Deep-merge defaults so new fields appear after updates.
    const looks = defaultLooks();
    for (const mode of Object.keys(looks) as CameraMode[]) {
        looks[mode] = { ...looks[mode], ...current.looks?.[mode] };
    }
    all[MODULE] = {
        ...structuredClone(DEFAULT_SETTINGS),
        ...current,
        backends: {
            openrouter: { ...DEFAULT_SETTINGS.backends.openrouter, ...current.backends?.openrouter },
            wavespeed: { ...DEFAULT_SETTINGS.backends.wavespeed, ...current.backends?.wavespeed },
        },
        looks,
    };
    migratePrompts(all[MODULE]);
    return all[MODULE];
}

const save = () => ctx().saveSettingsDebounced();

// Settings from before camera and audio modes: a single style/negative pair and an audio checkbox.
function migrateLegacyFields(current: any) {
    if (typeof current.styleSuffix === 'string' || typeof current.negativePrompt === 'string') {
        const look = { ...CAMERA_MODES.bystander.look };
        if (typeof current.styleSuffix === 'string') look.style = current.styleSuffix;
        if (typeof current.negativePrompt === 'string' && !LEGACY_NEGATIVE_HASHES.includes(promptHash(current.negativePrompt))) {
            look.negative = current.negativePrompt;
        }
        current.looks = { ...current.looks, bystander: { ...look, ...current.looks?.bystander } };
        delete current.styleSuffix;
        delete current.negativePrompt;
    }
    if (typeof current.aspect === 'string') {
        current.looks ??= {};
        for (const mode of ['bystander', 'pov', 'selfie'] as CameraMode[]) {
            current.looks[mode] = { aspect: current.aspect, ...current.looks[mode] };
        }
        delete current.aspect;
    }
    if (typeof current.audio === 'boolean') {
        current.audioMode ??= current.audio ? 'full' : 'none';
        delete current.audio;
    }
}

const look = (s: SceneVideoSettings) => s.looks[s.cameraMode] ?? CAMERA_MODES.bystander.look;

// Replaces prompts that still equal an earlier default; customized prompts are kept.
function migratePrompts(s: SceneVideoSettings) {
    if ((s.promptsVersion ?? 1) >= PROMPTS_VERSION) return;
    const latest = { systemPrompt: DEFAULT_SYSTEM_PROMPT, systemPromptH3: DEFAULT_SYSTEM_PROMPT_H3 };
    for (const key of Object.keys(LEGACY_PROMPT_HASHES) as (keyof typeof LEGACY_PROMPT_HASHES)[]) {
        if (LEGACY_PROMPT_HASHES[key].includes(promptHash(s[key]))) {
            s[key] = latest[key];
        }
    }
    s.promptsVersion = PROMPTS_VERSION;
    save();
}

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

function buildSceneContext(messageId: number, s: SceneVideoSettings, focus?: string): string {
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
    if (focus) {
        parts.push(`[LAST message]\n${target.name}: ${truncate(cleanText(target.mes), 4000)}`);
        parts.push(`[FOCUS: the user selected this fragment of the last message. The clip must show exactly this moment; use the rest only as context]\n${truncate(focus, 1500)}`);
    } else {
        parts.push(`[LAST message — film this moment]\n${target.name}: ${truncate(cleanText(target.mes), 4000)}`);
    }
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

function applyTemplate(template: string, s: SceneVideoSettings, h3: boolean, appendMissing = true): string {
    const camera = CAMERA_MODES[s.cameraMode] ?? CAMERA_MODES.bystander;
    const audio = AUDIO_MODES[s.audioMode] ?? AUDIO_MODES.full;
    const rules: Record<string, string> = {
        shots: shotRule(s.shotMode, h3, s.seconds),
        camera: camera.rule,
        audio: h3 ? audio.h3 : audio.generic,
        music: camera.music,
    };
    const example = h3 ? camera.example.h3 : camera.example.generic;
    // Custom prompts written before a placeholder existed still get its rule, appended at the end.
    let text = template;
    for (const [key, value] of Object.entries(rules)) {
        if (key === 'music' && !h3) continue;
        if (!appendMissing && !text.includes(`{{${key}}}`)) continue;
        text = text.includes(`{{${key}}}`)
            ? text.replaceAll(`{{${key}}}`, value)
            : `${text}\n\n${key[0].toUpperCase()}${key.slice(1)}: ${value}`;
    }
    return text
        .replaceAll('{{example}}', example)
        .replaceAll('{{user}}', ctx().name1 || 'the user')
        .replaceAll('{{words}}', String(Math.min(260, Math.max(80, Math.round(s.seconds * 20)))))
        .replaceAll('{{beats}}', String(Math.max(3, Math.min(6, Math.round(s.seconds / 3) + 1))))
        .replaceAll('{{seconds}}', String(s.seconds))
        .replaceAll('{{aspect}}', look(s).aspect)
        .replaceAll('{{style}}', look(s).style.trim() || 'Realistic live-action footage.');
}

// Prompt review popup with a Regenerate button that asks the LLM for a new prompt without closing.
async function reviewPrompt(messageId: number, prompt: string, note: string, isH3: boolean, focus?: string): Promise<string | null> {
    const c = ctx();
    let busy = false;
    let closed = false;
    // eslint-disable-next-line prefer-const
    let popup: any;
    const regenerate = async (event: Event) => {
        if (busy) return;
        busy = true;
        const button = event.currentTarget as HTMLElement;
        const label = button.querySelector('span');
        const input: HTMLTextAreaElement = popup.mainInput;
        button.classList.add('disabled');
        input.disabled = true;
        if (label) label.textContent = 'Regenerating…';
        try {
            const next = await writeVideoPrompt(messageId, settings(), focus);
            if (!closed) input.value = next;
        } catch (error: any) {
            toastr.error(String(error?.message ?? error), 'Scene Video');
        } finally {
            busy = false;
            button.classList.remove('disabled');
            input.disabled = false;
            if (label) label.textContent = 'Regenerate';
        }
    };
    popup = new c.Popup(`<h3>Video prompt</h3>${note}`, c.POPUP_TYPE.INPUT, prompt, {
        rows: isH3 ? 18 : 10,
        okButton: 'Generate',
        cancelButton: 'Cancel',
        wide: true,
        customButtons: [{ text: 'Regenerate', icon: 'fa-rotate', tooltip: 'Ask the LLM for a new prompt', action: regenerate }],
        onClosing: () => !busy || confirm('The prompt is still being regenerated. Close anyway?'),
        onClose: () => { closed = true; },
    });
    const value = await popup.show();
    if (value === '') return '';
    return value ? String(value) : null;
}

/** Sends one system + user request, through the chosen connection profile or the current chat connection. */
async function callLlm(s: SceneVideoSettings, system: string, user: string, maxTokens: number): Promise<string> {
    const c = ctx();
    if (!s.promptProfile) {
        return c.generateRaw({ systemPrompt: system, prompt: user, responseLength: maxTokens });
    }
    const service = c.ConnectionManagerRequestService;
    if (!service) throw new Error('Connection profiles are not available in this SillyTavern version.');
    const result = await service.sendRequest(
        s.promptProfile,
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        maxTokens,
        { stream: false, extractData: true, includePreset: true, includeInstruct: true },
    );
    return typeof result === 'string' ? result : String(result?.content ?? '');
}

async function writeVideoPrompt(messageId: number, s: SceneVideoSettings, focus?: string): Promise<string> {
    const format = resolvePromptFormat(s);
    const h3 = format === 'minimax-h3';
    const system = applyTemplate(h3 ? s.systemPromptH3 : s.systemPrompt, s, h3);
    const scene = buildSceneContext(messageId, s, focus);

    let plan = '';
    if (s.twoStep) {
        const planSystem = applyTemplate(PLAN_INSTRUCTION, s, h3, false) + system;
        plan = cleanLlmOutput(await callLlm(s, planSystem, `${scene}\n\nWrite the plan now.`, 500));
        console.debug('[Scene Video] plan', plan);
    }
    const task = plan
        ? `${scene}\n\n[PLAN for this clip]\n${plan}\n\nWrite the video prompt now. Follow the plan and the rules.`
        : `${scene}\n\nWrite the video prompt now.`;
    const raw = await callLlm(s, system, task, s.responseLength);

    const text = cleanLlmOutput(raw);
    if (!text) throw new Error('The LLM returned an empty video prompt.');
    if (h3) return normalizeH3Prompt(text);
    return cleanText(text).replace(/^["'«]|["'»]$/g, '').replace(/^(video )?prompt:\s*/i, '').trim();
}

/** The generic format gets the style suffix appended. H3 has the style inside [Shot 1]. */
function buildFinalPrompt(prompt: string, s: SceneVideoSettings): string {
    if (resolvePromptFormat(s) === 'minimax-h3') return prompt;
    const style = look(s).style.trim();
    return style ? `${prompt}\n\n${style}` : prompt;
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
    /** Fragment of the message to film instead of letting the LLM choose. */
    focus?: string;
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
        const focus = opts.focus?.trim() || undefined;
        if (!prompt) {
            toast = toastr.info(focus ? 'Writing the video prompt for the selected fragment…' : 'Writing the video prompt…', 'Scene Video', { timeOut: 0, extendedTimeOut: 0 });
            prompt = await writeVideoPrompt(messageId, s, focus);
            toastr.clear(toast);
        }

        const isH3 = resolvePromptFormat(s) === 'minimax-h3';
        if (s.confirmPrompt && !opts.quiet) {
            const note = isH3
                ? 'MiniMax H3 structured format. Keep the three fields and the <code>&lt;d&gt;</code> tags.'
                : 'The style suffix is added automatically.';
            const camera = CAMERA_MODES[s.cameraMode]?.label ?? s.cameraMode;
            const fragment = focus ? `<br>Selected fragment: <i>«${escapeHtml(truncate(focus, 300))}»</i>` : '';
            const edited = await reviewPrompt(messageId, prompt, `${note} Backend: <b>${s.backend}</b>, camera: <b>${camera}</b>.${fragment}`, isH3, focus);
            if (edited === null || edited === undefined || !String(edited).trim()) {
                return '';
            }
            prompt = String(edited).trim();
        }

        const finalPrompt = buildFinalPrompt(prompt, s);
        toast = toastr.info('Generating the video. This usually takes 1–5 minutes.', 'Scene Video', { timeOut: 0, extendedTimeOut: 0 });

        const video = await generateVideo({ prompt: finalPrompt, negative: look(s).negative, settings: s, signal: controller.signal });
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
    generateSceneVideo(messageId, { focus: takeSelection(messageId) }).catch(() => { /* already reported */ });
}

// ---------- selected fragment ----------

// Opening the message menu clears the text selection, so the last selection inside a message is kept
// until the user clicks somewhere other than that message's buttons.
let lastSelection: { messageId: number; text: string } | null = null;

function trackSelection() {
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!sel || !text || !sel.anchorNode || !sel.focusNode) return;
        const anchor = $(sel.anchorNode).closest('#chat .mes .mes_text');
        const focus = $(sel.focusNode).closest('#chat .mes .mes_text');
        if (!anchor.length || anchor[0] !== focus[0]) return;
        const messageId = Number(anchor.closest('.mes').attr('mesid'));
        if (!Number.isNaN(messageId)) lastSelection = { messageId, text };
    });
    document.addEventListener('pointerdown', (event) => {
        if (!lastSelection) return;
        const target = $(event.target as HTMLElement);
        const mes = target.closest('#chat .mes');
        const onOwnButtons = Number(mes.attr('mesid')) === lastSelection.messageId && target.closest('.mes_buttons, .extraMesButtons').length > 0;
        if (!onOwnButtons) lastSelection = null;
    }, true);
}

function takeSelection(messageId: number): string | undefined {
    const current = window.getSelection()?.toString().trim();
    const text = lastSelection?.messageId === messageId ? lastSelection.text : undefined;
    lastSelection = null;
    return text || current || undefined;
}

// ---------- message button ----------

const BUTTON_HTML = `<div title="Generate scene video (select text in the message first to film just that fragment)" class="mes_button ${BUTTON_CLASS} fa-solid fa-video"></div>`;

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
        renderModelSelect();
        setSelectValue('#scene_video_resolution', cfg.resolution);
        $('#scene_video_extra').val(cfg.extra);
        if (b === 'openrouter') loadOpenRouterModels();
    } else {
        refreshComfyWorkflows();
    }
    refreshPluginStatus();
    renderPromptFormat();
}

const CUSTOM_MODEL = '__custom__';

/** Video models fetched from OpenRouter. Null until loaded, then cached for the session. */
let openRouterModels: string[] | null = null;
let openRouterModelsLoading = false;

/** Sets a <select> value and adds the option if it isn't in the list (e.g. a value saved earlier). */
function setSelectValue(selector: string, value: string) {
    const select = $(selector);
    if (value && !select.find('option').filter((_i: number, o: HTMLOptionElement) => o.value === value).length) {
        select.append($('<option></option>').val(value).text(value));
    }
    select.val(value);
}

function renderModelSelect() {
    const s = settings();
    if (s.backend === 'comfy') return;
    const current = s.backends[s.backend].model;
    const known = s.backend === 'openrouter' && openRouterModels?.length
        ? [...new Set([...MODEL_SUGGESTIONS.openrouter, ...openRouterModels])]
        : MODEL_SUGGESTIONS[s.backend];

    const select = $('#scene_video_model_select').empty();
    for (const id of known) select.append($('<option></option>').val(id).text(id));
    select.append($('<option></option>').val(CUSTOM_MODEL).text('Custom…'));

    const isKnown = known.includes(current);
    select.val(isKnown ? current : CUSTOM_MODEL);
    $('#scene_video_model').val(current).toggle(!isKnown);
}

async function loadOpenRouterModels() {
    if (openRouterModels || openRouterModelsLoading) return;
    openRouterModelsLoading = true;
    try {
        const res = await fetch(`${PLUGIN_BASE}/openrouter/models`, { method: 'POST', headers: ctx().getRequestHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const models: any[] = data.data ?? data;
        openRouterModels = models.map(m => String(m.id)).filter(Boolean).sort();
        if (settings().backend === 'openrouter') renderModelSelect();
    } catch (error) {
        console.warn('[Scene Video] Could not load OpenRouter models', error);
    } finally {
        openRouterModelsLoading = false;
    }
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

// Connection profiles come from SillyTavern's Connection Manager; the empty option means the chat connection.
function initProfileSelect() {
    const service = ctx().ConnectionManagerRequestService;
    const label = () => $('#scene_video_profile option[value=""]').text('Same as chat (current connection)');
    try {
        if (!service) throw new Error('not available');
        service.handleDropdown('#scene_video_profile', settings().promptProfile, (profile?: { id: string }) => {
            settings().promptProfile = profile?.id ?? '';
            save();
            label();
        });
        label();
        // The saved profile may have been deleted.
        if (($('#scene_video_profile').val() ?? '') !== settings().promptProfile) {
            settings().promptProfile = '';
            save();
        }
    } catch {
        settings().promptProfile = '';
        $('#scene_video_profile').prop('disabled', true).empty().append('<option value="">Same as chat (current connection)</option>');
        $('#scene_video_profile_hint').text('Enable the Connection Manager extension to choose a separate LLM for prompts.');
    }
}

function renderLook() {
    const s = settings();
    const l = look(s);
    $('#scene_video_aspect').val(l.aspect);
    $('#scene_video_style').val(l.style);
    $('#scene_video_negative').val(l.negative);
    $('#scene_video_look_camera').text(CAMERA_MODES[s.cameraMode]?.label ?? s.cameraMode);
}

function initSettingsUI() {
    const s = settings();
    const container = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
    container.append(settingsHtml);

    $('#scene_video_enabled').prop('checked', s.enabled);
    $('#scene_video_confirm').prop('checked', s.confirmPrompt);
    $('#scene_video_auto').prop('checked', s.autoGenerate);
    $('#scene_video_backend').val(s.backend);
    $('#scene_video_comfy_url').val(s.comfyUrl);
    $('#scene_video_comfy_fps').val(s.comfyFps);
    $('#scene_video_seconds').val(s.seconds);
    $('#scene_video_shots').val(s.shotMode);
    $('#scene_video_camera').val(s.cameraMode);
    $('#scene_video_audio_mode').val(s.audioMode);
    $('#scene_video_context').val(s.contextMessages);
    $('#scene_video_response_length').val(s.responseLength);
    $('#scene_video_two_step').prop('checked', s.twoStep);
    initProfileSelect();
    $('#scene_video_system').val(s.systemPrompt);
    $('#scene_video_format').val(s.promptFormat);
    $('#scene_video_system_h3').val(s.systemPromptH3);
    renderLook();

    bindInput('#scene_video_enabled', (_v, c) => { settings().enabled = c; syncButtons(); });
    bindInput('#scene_video_confirm', (_v, c) => { settings().confirmPrompt = c; });
    bindInput('#scene_video_auto', (_v, c) => { settings().autoGenerate = c; });
    $('#scene_video_backend').on('change', function (this: HTMLSelectElement) {
        settings().backend = this.value as BackendId;
        save();
        renderBackendSection();
    });
    $('#scene_video_model_select').on('change', function (this: HTMLSelectElement) {
        const custom = this.value === CUSTOM_MODEL;
        const input = $('#scene_video_model').toggle(custom);
        if (custom) {
            input.trigger('focus');
            return;
        }
        cloudCfg().model = this.value;
        input.val(this.value);
        save();
        renderPromptFormat();
    });
    bindInput('#scene_video_model', v => { cloudCfg().model = v.trim(); renderPromptFormat(); });
    bindInput('#scene_video_format', v => { settings().promptFormat = v as PromptFormat; renderPromptFormat(); });
    bindInput('#scene_video_system_h3', v => { settings().systemPromptH3 = v; });
    bindInput('#scene_video_resolution', v => { cloudCfg().resolution = v.trim(); });
    bindInput('#scene_video_extra', v => { cloudCfg().extra = v; });
    bindInput('#scene_video_comfy_url', v => { settings().comfyUrl = v.trim(); });
    bindInput('#scene_video_comfy_workflow', v => { settings().comfyWorkflow = v; });
    bindInput('#scene_video_comfy_fps', v => { settings().comfyFps = Number(v) || 24; });
    bindInput('#scene_video_seconds', v => { settings().seconds = Number(v) || DEFAULT_SETTINGS.seconds; });
    bindInput('#scene_video_aspect', v => { look(settings()).aspect = v as Aspect; });
    bindInput('#scene_video_two_step', (_v, c) => { settings().twoStep = c; });
    bindInput('#scene_video_shots', v => { settings().shotMode = v as ShotMode; });
    bindInput('#scene_video_camera', v => { settings().cameraMode = v as CameraMode; renderLook(); });
    bindInput('#scene_video_audio_mode', v => { settings().audioMode = v as AudioMode; });
    bindInput('#scene_video_context', v => { settings().contextMessages = Math.max(0, Number(v) || 0); });
    bindInput('#scene_video_response_length', v => { settings().responseLength = Number(v) || DEFAULT_SETTINGS.responseLength; });
    bindInput('#scene_video_system', v => { settings().systemPrompt = v; });
    bindInput('#scene_video_style', v => { look(settings()).style = v; });
    bindInput('#scene_video_negative', v => { look(settings()).negative = v; });

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
        st.looks = defaultLooks();
        $('#scene_video_system').val(st.systemPrompt);
        $('#scene_video_system_h3').val(st.systemPromptH3);
        renderLook();
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
                focus: args.focus ? String(args.focus) : undefined,
            });
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({ name: 'prompt', description: 'Ready video prompt (skips the LLM step)', typeList: ['string'] }),
            SlashCommandNamedArgument.fromProps({ name: 'focus', description: 'Fragment of the message to film; the LLM builds the clip around it', typeList: ['string'] }),
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
    trackSelection();

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
