// Default extension settings.

import { DEFAULT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT_H3 } from './instructions';
import type { SceneVideoSettings } from '../types';
import { defaultLooks } from '../helpers/looks';

export const DEFAULT_SETTINGS: SceneVideoSettings = {
    enabled: true,
    autoGenerate: false,
    confirmPrompt: true,
    preflight: false,
    backend: 'openrouter',
    backends: {
        openrouter: { model: 'minimax/hailuo-3', resolution: '', extra: '' },
        wavespeed: { model: 'wavespeed-ai/minimax-h3/text-to-video', resolution: '768p', extra: '' },
    },
    seconds: 6,
    shotMode: 'single',
    cameraMode: 'bystander',
    audioMode: 'full',
    comfyUrl: 'http://127.0.0.1:8188',
    comfyWorkflow: '',
    comfyFps: 24,
    contextMessages: 4,
    responseLength: 700,
    promptProfile: '',
    twoStep: true,
    promptFormat: 'auto',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    systemPromptH3: DEFAULT_SYSTEM_PROMPT_H3,
    looks: defaultLooks(),
};
