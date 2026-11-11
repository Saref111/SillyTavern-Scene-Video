/* eslint-disable @typescript-eslint/no-explicit-any */
// Backend section of the settings panel: model list, resolution, ComfyUI workflows, plugin status.

import { MODEL_SUGGESTIONS } from '../../defaults';
import { getPluginStatus, listComfyWorkflows, PLUGIN_BASE } from '../../backends';
import { ctx } from '../../core/context';
import { settings } from '../../core/settings';
import { escapeHtml } from '../../core/text';
import { resolvePromptFormat } from '../../prompt';

export async function refreshPluginStatus() {
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

export async function refreshComfyWorkflows() {
    const s = settings();
    const list = await listComfyWorkflows();
    const select = $('#scene_video_comfy_workflow').empty();
    select.append('<option value="">— select —</option>');
    for (const name of list) {
        select.append($('<option></option>').val(name).text(name));
    }
    select.val(s.comfyWorkflow);
}

export function renderBackendSection() {
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

export const CUSTOM_MODEL = '__custom__';

/** Video models fetched from OpenRouter. Null until loaded, then cached for the session. */
let openRouterModels: string[] | null = null;
let openRouterModelsLoading = false;

/** Sets a <select> value and adds the option if it isn't in the list (e.g. a value saved earlier). */
export function setSelectValue(selector: string, value: string) {
    const select = $(selector);
    if (value && !select.find('option').filter((_i: number, o: HTMLOptionElement) => o.value === value).length) {
        select.append($('<option></option>').val(value).text(value));
    }
    select.val(value);
}

export function renderModelSelect() {
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

export async function loadOpenRouterModels() {
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

export function renderPromptFormat() {
    const s = settings();
    const resolved = resolvePromptFormat(s);
    $('#scene_video_system_generic_block').toggle(resolved === 'generic');
    $('#scene_video_system_h3_block').toggle(resolved === 'minimax-h3');
    $('#scene_video_format_status').text(s.promptFormat === 'auto'
        ? `Active: ${resolved === 'minimax-h3' ? 'MiniMax H3' : 'generic'}`
        : '');
}

export async function showOpenRouterModels() {
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
