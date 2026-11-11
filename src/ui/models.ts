/* eslint-disable @typescript-eslint/no-explicit-any */
// Model lists of the services, fetched once per session: video models of OpenRouter and WaveSpeed (through
// the server plugin), image models for appearance cards (WaveSpeed through the plugin, OpenRouter through
// SillyTavern) and SillyTavern's ComfyUI workflows. Until a list arrives (or when it can't be loaded) the
// built-in suggestions are used.

import { MODEL_SUGGESTIONS } from '../defaults';
import { listComfyWorkflows, PLUGIN_BASE } from '../backends';
import { ctx } from '../core/context';

export type CloudBackend = 'openrouter' | 'wavespeed';
export type ModelSource = CloudBackend | 'wavespeed-image' | 'openrouter-image' | 'comfy-workflow';

export interface ModelOption {
    id: string;
    /** Text shown in the list: the id plus the price when the service gives one. */
    label: string;
}

const SUGGESTIONS: Record<ModelSource, string[]> = {
    ...MODEL_SUGGESTIONS,
    'wavespeed-image': ['wavespeed-ai/minimax-h3/text-to-image', 'wavespeed-ai/krea-v2/turbo', 'bytedance/seedream-v4.5'],
    'openrouter-image': ['minimax/minimax-h3-image', 'google/gemini-3.1-flash-image', 'krea/krea-2-medium-turbo'],
    'comfy-workflow': [],
};

const loaded: Partial<Record<ModelSource, ModelOption[]>> = {};
const pending: Partial<Record<ModelSource, Promise<ModelOption[]>>> = {};
/** Why the last load failed, e.g. a missing API key. */
export const loadErrors: Partial<Record<ModelSource, string>> = {};

function suggestions(source: ModelSource): ModelOption[] {
    return SUGGESTIONS[source].map(id => ({ id, label: id }));
}

async function postForJson(url: string, body?: object): Promise<any> {
    const res = await fetch(url, { method: 'POST', headers: ctx().getRequestHeaders(), body: body ? JSON.stringify(body) : undefined });
    if (res.status === 404) throw new Error('the server plugin is outdated, restart SillyTavern');
    if (!res.ok) {
        const text = (await res.text()).trim();
        throw new Error(text && !text.startsWith('<') ? text : `HTTP ${res.status}`);
    }
    return res.json();
}

const wavespeedOption = (m: any): ModelOption => ({ id: String(m.id), label: `${m.id}${typeof m.price === 'number' ? ` — from $${m.price}` : ''}` });

async function fetchModels(source: ModelSource): Promise<ModelOption[]> {
    switch (source) {
        case 'openrouter': {
            const data = await postForJson(`${PLUGIN_BASE}/openrouter/models`);
            const models: any[] = data.data ?? data;
            return models.map(m => {
                const price = m.pricing_skus?.duration_seconds ? ` — $${m.pricing_skus.duration_seconds}/s` : '';
                return { id: String(m.id), label: `${m.id}${price}` };
            }).filter(m => m.id).sort((a, b) => a.id.localeCompare(b.id));
        }
        case 'wavespeed':
            return (await postForJson(`${PLUGIN_BASE}/wavespeed/models`) as any[]).map(wavespeedOption);
        case 'wavespeed-image':
            return (await postForJson(`${PLUGIN_BASE}/wavespeed/models`, { kind: 'image' }) as any[]).map(wavespeedOption);
        case 'openrouter-image': {
            // SillyTavern's own list (the one its Image Generation uses): [{ value, text }].
            const models: any[] = await postForJson('/api/openrouter/models/image');
            return models.map(m => ({ id: String(m.value), label: m.text && m.text !== m.value ? `${m.value} — ${m.text}` : String(m.value) }))
                .filter(m => m.id).sort((a, b) => a.id.localeCompare(b.id));
        }
        case 'comfy-workflow':
            return (await listComfyWorkflows()).map(name => ({ id: name, label: name }));
    }
}

/** The models already loaded, or the built-in suggestions. */
export function knownModels(source: ModelSource): ModelOption[] {
    return loaded[source] ?? suggestions(source);
}

/** Loads a list once per session; `force` loads it again (e.g. after setting a key). */
export function loadModels(source: ModelSource, force = false): Promise<ModelOption[]> {
    if (force) {
        delete loaded[source];
        delete pending[source];
    }
    if (loaded[source]) return Promise.resolve(loaded[source]!);
    pending[source] ??= fetchModels(source)
        .then(models => {
            delete loadErrors[source];
            if (models.length) loaded[source] = models;
            return knownModels(source);
        })
        .catch(error => {
            loadErrors[source] = String(error?.message ?? error);
            console.warn(`[Scene Video] Could not load the ${source} list`, error);
            return suggestions(source);
        })
        .finally(() => { delete pending[source]; });
    return pending[source]!;
}
