// Pre-generation popup: per-clip settings that can be changed before every video without opening the settings panel.
import { Aspect, AUDIO_MODES, AudioMode, BackendId, CAMERA_MODES, CameraMode, H3_MODEL_PATTERN, MODEL_SUGGESTIONS, SceneVideoSettings, ShotMode } from '../defaults';
import { listComfyWorkflows } from '../backends';

export interface PreflightInput {
    settings: SceneVideoSettings;
    focus?: string;
    direction?: string;
    /** False when a ready prompt was given: the LLM fields are then hidden. */
    needsPrompt: boolean;
}

export interface PreflightResult {
    /** A copy of the settings with the popup's choices applied. */
    settings: SceneVideoSettings;
    focus?: string;
    direction?: string;
    saveAsDefault: boolean;
}

const RESOLUTIONS = ['', '480p', '540p', '720p', '768p', '1080p', '2K', '4K'];
const ASPECTS: Aspect[] = ['9:16', '16:9', '1:1', '3:4', '4:3'];
const SHOTS: Record<ShotMode, string> = {
    single: 'One continuous shot',
    multi: 'Several shots (cuts)',
    auto: 'Let the LLM decide',
};

const esc = (text: unknown) => String(text ?? '').replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const options = (pairs: [string, string][]) => pairs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');

function formHtml(input: PreflightInput): string {
    const profiles: { id: string; name: string }[] = SillyTavern.getContext().extensionSettings.connectionManager?.profiles ?? [];
    const llm = input.needsPrompt ? '' : ' style="display:none"';
    return `
<div class="scene-video-preflight">
    <h3>Scene Video: this clip</h3>
    <div class="scene-video-pf-grid">
        <label>Backend
            <select data-pf="backend" class="text_pole">${options([['openrouter', 'OpenRouter'], ['wavespeed', 'WaveSpeed'], ['comfy', 'ComfyUI']])}</select>
        </label>
        <label class="pf-cloud">Model
            <input data-pf="model" class="text_pole" list="scene_video_pf_models" />
            <datalist id="scene_video_pf_models"></datalist>
        </label>
        <label class="pf-cloud">Resolution
            <select data-pf="resolution" class="text_pole">${options(RESOLUTIONS.map(r => [r, r || 'Model default']))}</select>
        </label>
        <label class="pf-comfy">Workflow
            <select data-pf="comfyWorkflow" class="text_pole"></select>
        </label>
        <label>Duration, s
            <input data-pf="seconds" type="number" min="2" max="20" class="text_pole" />
        </label>
        <label>Aspect
            <select data-pf="aspect" class="text_pole">${options(ASPECTS.map(a => [a, a]))}</select>
        </label>
        <label>Camera
            <select data-pf="cameraMode" class="text_pole">${options(Object.entries(CAMERA_MODES).map(([k, v]) => [k, v.label]))}</select>
        </label>
        <label>Sound
            <select data-pf="audioMode" class="text_pole">${options(Object.entries(AUDIO_MODES).map(([k, v]) => [k, v.label]))}</select>
        </label>
        <label>Shots
            <select data-pf="shotMode" class="text_pole">${options(Object.entries(SHOTS))}</select>
        </label>
        <label${llm}>LLM for the prompt
            <select data-pf="promptProfile" class="text_pole">${options([['', 'Same as chat'], ...profiles.map(p => [p.id, p.name] as [string, string])])}</select>
        </label>
        <label${llm}>Context messages
            <input data-pf="contextMessages" type="number" min="0" max="20" class="text_pole" />
        </label>
    </div>
    <small class="scene-video-hint" data-pf="format"></small>
    <div${llm}>
        <label class="checkbox_label"><input type="checkbox" data-pf="twoStep" /> Plan the clip first (two LLM calls)</label>
        <label>Fragment to film <small>(empty: the LLM picks the moments)</small>
            <textarea data-pf="focus" class="text_pole" rows="3"></textarea>
        </label>
        <label>Direction for this clip <small>(optional, e.g. "end on her laughing into the lens", "no dialogue")</small>
            <textarea data-pf="direction" class="text_pole" rows="2"></textarea>
        </label>
    </div>
    <label class="checkbox_label"><input type="checkbox" data-pf="saveAsDefault" /> Save these as the default settings</label>
</div>`;
}

export async function showPreflight(input: PreflightInput): Promise<PreflightResult | null> {
    const c = SillyTavern.getContext();
    const s: SceneVideoSettings = structuredClone(input.settings);
    const form = $(formHtml(input));
    const field = (name: string) => form.find(`[data-pf="${name}"]`);

    const cloud = () => s.backend === 'comfy' ? null : s.backends[s.backend];

    // Model and resolution belong to the chosen cloud backend, so they are re-read when it changes.
    const renderBackend = () => {
        form.find('.pf-cloud').toggle(s.backend !== 'comfy');
        form.find('.pf-comfy').toggle(s.backend === 'comfy');
        const cfg = cloud();
        if (cfg) {
            field('model').val(cfg.model);
            const list = form.find('#scene_video_pf_models').empty();
            for (const id of MODEL_SUGGESTIONS[s.backend as 'openrouter' | 'wavespeed']) list.append($('<option></option>').val(id));
            const res = field('resolution');
            if (cfg.resolution && !res.find('option').filter((_i: number, o: HTMLOptionElement) => o.value === cfg.resolution).length) {
                res.append($('<option></option>').val(cfg.resolution).text(cfg.resolution));
            }
            res.val(cfg.resolution);
        } else {
            listComfyWorkflows().then((names) => {
                const select = field('comfyWorkflow').empty().append('<option value="">— select —</option>');
                for (const name of names) select.append($('<option></option>').val(name).text(name));
                select.val(s.comfyWorkflow);
            }).catch(() => { /* the list stays empty */ });
        }
        renderFormat();
    };
    const renderFormat = () => {
        const cfg = cloud();
        const h3 = s.promptFormat === 'minimax-h3' || (s.promptFormat === 'auto' && !!cfg && H3_MODEL_PATTERN.test(cfg.model));
        field('format').text(`Prompt format: ${h3 ? 'MiniMax H3' : 'generic'}`);
    };

    field('backend').val(s.backend);
    field('seconds').val(s.seconds);
    field('cameraMode').val(s.cameraMode);
    field('aspect').val(s.looks[s.cameraMode].aspect);
    field('audioMode').val(s.audioMode);
    field('shotMode').val(s.shotMode);
    field('promptProfile').val(s.promptProfile);
    if (field('promptProfile').val() !== s.promptProfile) field('promptProfile').val('');
    field('contextMessages').val(s.contextMessages);
    field('twoStep').prop('checked', s.twoStep);
    field('focus').val(input.focus ?? '');
    field('direction').val(input.direction ?? '');
    renderBackend();

    field('backend').on('change', function (this: HTMLSelectElement) {
        s.backend = this.value as BackendId;
        renderBackend();
    });
    field('model').on('input', function (this: HTMLInputElement) {
        const cfg = cloud();
        if (cfg) cfg.model = this.value.trim();
        renderFormat();
    });
    // Each camera has its own aspect ratio.
    field('cameraMode').on('change', function (this: HTMLSelectElement) {
        s.cameraMode = this.value as CameraMode;
        field('aspect').val(s.looks[s.cameraMode].aspect);
    });

    const popup = new c.Popup(form[0], c.POPUP_TYPE.CONFIRM, '', {
        okButton: input.needsPrompt ? 'Write prompt' : 'Generate',
        cancelButton: 'Cancel',
        wide: true,
        allowVerticalScrolling: true,
    });
    const result = await popup.show();
    if (result !== c.POPUP_RESULT.AFFIRMATIVE) return null;

    const cfg = cloud();
    if (cfg) cfg.resolution = String(field('resolution').val() ?? '');
    s.comfyWorkflow = String(field('comfyWorkflow').val() || s.comfyWorkflow);
    s.seconds = Number(field('seconds').val()) || s.seconds;
    s.looks[s.cameraMode].aspect = String(field('aspect').val()) as Aspect;
    s.audioMode = String(field('audioMode').val()) as AudioMode;
    s.shotMode = String(field('shotMode').val()) as ShotMode;
    s.promptProfile = String(field('promptProfile').val() ?? '');
    s.contextMessages = Math.max(0, Number(field('contextMessages').val()) || 0);
    s.twoStep = field('twoStep').prop('checked');

    return {
        settings: s,
        focus: String(field('focus').val() ?? '').trim() || undefined,
        direction: String(field('direction').val() ?? '').trim() || undefined,
        saveAsDefault: field('saveAsDefault').prop('checked'),
    };
}
