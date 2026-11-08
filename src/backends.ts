import { H3_MODEL_PATTERN, SceneVideoSettings } from './defaults';

export const PLUGIN_BASE = '/api/plugins/scene-video';

export interface VideoResult {
    format: string;
    data: string; // base64
}

interface GenerateArgs {
    prompt: string;
    negative: string;
    settings: SceneVideoSettings;
    signal: AbortSignal;
}

function headers(): Record<string, string> {
    return SillyTavern.getContext().getRequestHeaders();
}

async function postJson(url: string, body: unknown, signal?: AbortSignal) {
    const res = await fetch(url, {
        method: 'POST',
        headers: headers(),
        signal,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        if (res.status === 404 && url.startsWith(PLUGIN_BASE)) {
            throw new Error('The Scene Video server plugin is not loaded. Install it into SillyTavern/plugins and set enableServerPlugins: true in config.yaml.');
        }
        throw new Error(text || `${res.status} ${res.statusText}`);
    }
    return res.json();
}

function parseExtra(raw: string): Record<string, unknown> {
    if (!raw.trim()) return {};
    try {
        const value = JSON.parse(raw);
        if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch {
        // fallthrough
    }
    throw new Error('"Extra params" must be a JSON object, e.g. {"seed": 42}');
}

// OpenRouter and WaveSpeed go through the server plugin, which holds the API keys.
async function generateCloud({ prompt, negative, settings, signal }: GenerateArgs): Promise<VideoResult> {
    const backend = settings.backend as 'openrouter' | 'wavespeed';
    const cfg = settings.backends[backend];
    const data = await postJson(`${PLUGIN_BASE}/generate`, {
        backend,
        model: cfg.model,
        prompt,
        // MiniMax H3 has no negative prompt; other WaveSpeed models may accept one.
        negative: backend === 'wavespeed' && !H3_MODEL_PATTERN.test(cfg.model) ? negative : undefined,
        seconds: settings.seconds,
        aspect: settings.aspect,
        resolution: cfg.resolution || undefined,
        audio: backend === 'openrouter' ? settings.audioMode !== 'none' : undefined,
        extra: parseExtra(cfg.extra),
    }, signal);
    return { format: data.format, data: data.data };
}

function comfySize(aspect: SceneVideoSettings['aspect']): [number, number] {
    switch (aspect) {
        case '9:16': return [704, 1280];
        case '16:9': return [1280, 704];
        case '1:1': return [960, 960];
        case '3:4': return [768, 1024];
        case '4:3': return [1024, 768];
    }
}

// ComfyUI uses SillyTavern's built-in Comfy endpoints and workflows from data/<user>/user/workflows.
// Placeholders: "%prompt%", "%negative_prompt%", "%seed%", "%width%", "%height%", "%length%" (frames), "%fps%", "%seconds%".
async function generateComfy({ prompt, negative, settings, signal }: GenerateArgs): Promise<VideoResult> {
    if (!settings.comfyWorkflow) {
        throw new Error('Choose a ComfyUI workflow in the Scene Video settings.');
    }
    const wfRes = await fetch('/api/sd/comfy/workflow', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ file_name: settings.comfyWorkflow }),
    });
    if (!wfRes.ok) {
        throw new Error(`Failed to load workflow: ${await wfRes.text()}`);
    }
    const [width, height] = comfySize(settings.aspect);
    // Wan-style models expect 4n+1 frames.
    const length = Math.round((settings.seconds * settings.comfyFps) / 4) * 4 + 1;
    const values: Record<string, unknown> = {
        prompt,
        negative_prompt: negative,
        seed: Math.floor(Math.random() * 2 ** 32),
        width,
        height,
        length,
        fps: settings.comfyFps,
        seconds: settings.seconds,
    };
    let workflow: string = await wfRes.json();
    for (const [key, value] of Object.entries(values)) {
        workflow = workflow.replaceAll(`"%${key}%"`, JSON.stringify(value));
    }
    const data = await postJson('/api/sd/comfy/generate', {
        url: settings.comfyUrl,
        prompt: `{"prompt": ${workflow}}`,
    }, signal);
    return { format: data.format, data: data.data };
}

export async function generateVideo(args: GenerateArgs): Promise<VideoResult> {
    const result = args.settings.backend === 'comfy' ? await generateComfy(args) : await generateCloud(args);
    if (!result?.data) {
        throw new Error('The backend returned no video data.');
    }
    return result;
}

export async function listComfyWorkflows(): Promise<string[]> {
    try {
        const res = await fetch('/api/sd/comfy/workflows', { method: 'POST', headers: headers() });
        return res.ok ? await res.json() : [];
    } catch {
        return [];
    }
}

export async function getPluginStatus(): Promise<{ openrouter: boolean; wavespeed: boolean } | null> {
    try {
        const res = await fetch(`${PLUGIN_BASE}/status`, { method: 'POST', headers: headers() });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

export async function saveWaveSpeedKey(value: string): Promise<void> {
    const res = await fetch('/api/secrets/write', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ key: 'api_key_wavespeed', value, label: 'Scene Video' }),
    });
    if (!res.ok) {
        throw new Error(`Failed to save key: ${res.status}`);
    }
}
