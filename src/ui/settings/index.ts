/* eslint-disable @typescript-eslint/no-explicit-any */
// The extension's settings panel.

import settingsHtml from '../../settings.html';
import { CAMERA_MODES, DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT_H3, defaultLooks } from '../../defaults';
import type { Aspect, AudioMode, BackendId, CameraMode, PromptFormat, ShotMode } from '../../defaults';
import { saveWaveSpeedKey } from '../../backends';
import { syncButtons } from '../../chat/button';
import { cloudCfg, look, save, settings } from '../../core/settings';
import { CUSTOM_MODEL, refreshComfyWorkflows, refreshPluginStatus, renderBackendSection, renderPromptFormat, showOpenRouterModels } from './backend';
import { initProfileSelect } from './profile';

/** Puts the saved settings into the settings panel controls. */
export function syncSettingsUI() {
    const s = settings();
    $('#scene_video_enabled').prop('checked', s.enabled);
    $('#scene_video_confirm').prop('checked', s.confirmPrompt);
    $('#scene_video_preflight').prop('checked', s.preflight);
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
    $('#scene_video_profile').val(s.promptProfile);
    $('#scene_video_system').val(s.systemPrompt);
    $('#scene_video_format').val(s.promptFormat);
    $('#scene_video_system_h3').val(s.systemPromptH3);
    renderLook();
    if ($('#scene_video_settings').length) renderBackendSection();
}

export function bindInput(selector: string, apply: (value: string, checked: boolean) => void) {
    $(selector).on('input change', function (this: HTMLInputElement) {
        apply(String($(this).val() ?? ''), Boolean(this.checked));
        save();
    });
}

export function renderLook() {
    const s = settings();
    const l = look(s);
    $('#scene_video_aspect').val(l.aspect);
    $('#scene_video_style').val(l.style);
    $('#scene_video_negative').val(l.negative);
    $('#scene_video_look_camera').text(CAMERA_MODES[s.cameraMode]?.label ?? s.cameraMode);
}

export function initSettingsUI() {
    const container = $('#extensions_settings2').length ? $('#extensions_settings2') : $('#extensions_settings');
    container.append(settingsHtml);

    initProfileSelect();
    syncSettingsUI();

    bindInput('#scene_video_enabled', (_v, c) => { settings().enabled = c; syncButtons(); });
    bindInput('#scene_video_confirm', (_v, c) => { settings().confirmPrompt = c; });
    bindInput('#scene_video_preflight', (_v, c) => { settings().preflight = c; });
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
}
