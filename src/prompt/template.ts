// Fills the {{placeholders}} of an LLM instruction from the settings.

import { AUDIO_MODES, CAMERA_MODES, shotRule } from '../defaults';
import type { SceneVideoSettings } from '../defaults';
import { ctx } from '../core/context';
import { look } from '../core/settings';

export function applyTemplate(template: string, s: SceneVideoSettings, h3: boolean, appendMissing = true): string {
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
