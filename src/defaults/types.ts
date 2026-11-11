// Shared types for settings, backends, cameras and sound.

export type BackendId = 'openrouter' | 'wavespeed' | 'comfy';

/** How the LLM formats the video prompt. `auto` picks `minimax-h3` for H3 models. */
export type PromptFormat = 'auto' | 'generic' | 'minimax-h3';

export interface BackendConfig {
    model: string;
    resolution: string;
    /** JSON object merged into the request body; `null` values remove a field. */
    extra: string;
}

/** single: one continuous shot; multi: several shots joined by cuts; auto: the LLM decides. */
export type ShotMode = 'single' | 'multi' | 'auto';

/** Who or what records the clip. */
export type CameraMode = 'bystander' | 'pov' | 'selfie' | 'cctv' | 'cinematic';

/** What the clip sounds like. */
export type AudioMode = 'full' | 'dialogue' | 'ambient' | 'none';

export type Aspect = '9:16' | '16:9' | '1:1' | '3:4' | '4:3';

/** Aspect ratio, style and negative prompt, kept separately for each camera mode. */
export interface Look {
    aspect: Aspect;
    style: string;
    negative: string;
}

export interface SceneVideoSettings {
    promptsVersion?: number;
    enabled: boolean;
    autoGenerate: boolean;
    confirmPrompt: boolean;
    /** Show a popup with the per-clip settings before each generation. */
    preflight: boolean;
    backend: BackendId;
    backends: Record<'openrouter' | 'wavespeed', BackendConfig>;
    seconds: number;
    shotMode: ShotMode;
    cameraMode: CameraMode;
    audioMode: AudioMode;
    comfyUrl: string;
    comfyWorkflow: string;
    comfyFps: number;
    contextMessages: number;
    responseLength: number;
    /** Connection profile id for writing prompts; empty means the current chat connection. */
    promptProfile: string;
    /** Plan the clip in a first LLM call, then write the prompt from the plan. */
    twoStep: boolean;
    promptFormat: PromptFormat;
    /** Instruction for the generic format. */
    systemPrompt: string;
    /** Instruction for the MiniMax H3 structured format. */
    systemPromptH3: string;
    looks: Record<CameraMode, Look>;
}
