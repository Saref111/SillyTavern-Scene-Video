/* eslint-disable @typescript-eslint/no-explicit-any */
// Saved settings: reading with defaults, migrations of older settings and small accessors.

import { CAMERA_MODES, DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT_H3, defaultLooks, LEGACY_NEGATIVE_HASHES, LEGACY_PROMPT_HASHES, promptHash, PROMPTS_VERSION } from '../defaults';
import type { CameraMode, SceneVideoSettings } from '../defaults';
import { ctx, MODULE } from './context';

export function settings(): SceneVideoSettings {
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

export const save = () => ctx().saveSettingsDebounced();

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

export const look = (s: SceneVideoSettings) => s.looks[s.cameraMode] ?? CAMERA_MODES.bystander.look;

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

export function cloudCfg() {
    const s = settings();
    return s.backends[s.backend as 'openrouter' | 'wavespeed'];
}

/** Copies the per-clip fields chosen in the pre-generation popup into the saved settings. */
export function persistClipSettings(clip: SceneVideoSettings) {
    const s = settings();
    for (const key of ['backend', 'seconds', 'cameraMode', 'audioMode', 'shotMode', 'twoStep', 'contextMessages', 'promptProfile', 'comfyWorkflow'] as const) {
        (s as any)[key] = clip[key];
    }
    s.backends = structuredClone(clip.backends);
    s.looks[clip.cameraMode].aspect = clip.looks[clip.cameraMode].aspect;
    save();
}
