// SillyTavern server plugin for Scene Video.
// It proxies OpenRouter and WaveSpeed video APIs so that API keys stay in the
// SillyTavern secret store and never reach the browser.
//
// Install: copy (or symlink) this folder to <SillyTavern>/plugins/scene-video
// and set `enableServerPlugins: true` in config.yaml.

import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const info = {
    id: 'scene-video',
    name: 'Scene Video',
    description: 'Proxy for OpenRouter and WaveSpeed video generation APIs.',
};

const SECRET_OPENROUTER = 'api_key_openrouter';
const SECRET_WAVESPEED = 'api_key_wavespeed';
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

const OR_BASE = 'https://openrouter.ai/api/v1';
const WS_BASE = 'https://api.wavespeed.ai/api/v3';
const OR_HEADERS = { 'HTTP-Referer': 'https://sillytavern.app', 'X-Title': 'SillyTavern' };

let readSecret = null;

// The plugin folder may be a symlink, so ST modules are resolved from the ST root (cwd).
async function loadSecrets() {
    const candidates = [
        path.resolve(process.cwd(), 'src/endpoints/secrets.js'),
        path.resolve(import.meta.dirname ?? '.', '../../src/endpoints/secrets.js'),
        path.resolve(import.meta.dirname ?? '.', '../../../src/endpoints/secrets.js'),
    ];
    for (const file of candidates) {
        try {
            const mod = await import(pathToFileURL(file).href);
            if (typeof mod.readSecret === 'function') {
                return mod.readSecret;
            }
        } catch {
            // try next
        }
    }
    throw new Error('Scene Video: could not locate SillyTavern secrets module');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

async function fetchJson(url, options, what) {
    const res = await fetch(url, options);
    const text = await res.text();
    if (!res.ok) {
        throw new HttpError(res.status, `${what} failed: ${res.status} ${text.slice(0, 1000)}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new HttpError(502, `${what}: invalid JSON response`);
    }
}

async function downloadBase64(url, headers, signal) {
    const res = await fetch(url, { headers, signal });
    if (!res.ok) {
        throw new HttpError(res.status, `Video download failed: ${res.status} ${(await res.text()).slice(0, 500)}`);
    }
    const contentType = res.headers.get('content-type') || '';
    const buffer = Buffer.from(await res.arrayBuffer());
    let format = 'mp4';
    if (contentType.includes('webm') || /\.webm(\?|$)/i.test(url)) format = 'webm';
    else if (contentType.includes('quicktime') || /\.mov(\?|$)/i.test(url)) format = 'mov';
    return { format, data: buffer.toString('base64') };
}

function getKey(request, secretKey, label) {
    const key = readSecret(request.user.directories, secretKey);
    if (!key) {
        throw new HttpError(400, `${label} API key is not set`);
    }
    return key;
}

function withoutNulls(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

// ---------- OpenRouter ----------

async function generateOpenRouter(request, signal) {
    const key = getKey(request, SECRET_OPENROUTER, 'OpenRouter');
    const headers = { ...OR_HEADERS, 'Authorization': `Bearer ${key}` };
    const b = request.body;

    const body = withoutNulls({
        model: b.model,
        prompt: b.prompt,
        duration: b.seconds ? Number(b.seconds) : undefined,
        aspect_ratio: b.aspect,
        resolution: b.resolution,
        generate_audio: b.audio,
        seed: b.seed,
        ...(b.extra || {}),
    });

    console.info('[scene-video] OpenRouter submit', { ...body, prompt: `${String(body.prompt).slice(0, 80)}…` });
    const job = await fetchJson(`${OR_BASE}/videos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    }, 'OpenRouter submit');

    if (!job?.id) {
        throw new HttpError(502, 'OpenRouter returned no job id');
    }
    const pollUrl = job.polling_url || `${OR_BASE}/videos/${job.id}`;
    const started = Date.now();

    for (let attempt = 0; Date.now() - started < POLL_TIMEOUT_MS; attempt++) {
        await sleep(Math.min(3000 + attempt * 1000, 10000));
        if (signal.aborted) throw new HttpError(499, 'Aborted by client');

        const status = await fetchJson(pollUrl, { headers, signal }, 'OpenRouter poll');
        console.debug(`[scene-video] OpenRouter job ${job.id}: ${status.status}`);

        if (status.status === 'completed') {
            const signed = Array.isArray(status.urls) ? status.urls[0]?.url ?? status.urls[0] : null;
            if (typeof signed === 'string') {
                return downloadBase64(signed, {}, signal);
            }
            return downloadBase64(`${OR_BASE}/videos/${job.id}/content?index=0`, headers, signal);
        }
        if (['failed', 'cancelled', 'expired'].includes(status.status)) {
            const err = typeof status.error === 'string' ? status.error : JSON.stringify(status.error ?? status.status);
            throw new HttpError(502, `OpenRouter job ${status.status}: ${err}`);
        }
    }
    throw new HttpError(504, 'OpenRouter video generation timed out');
}

// ---------- WaveSpeed ----------

async function generateWaveSpeed(request, signal) {
    const key = getKey(request, SECRET_WAVESPEED, 'WaveSpeed');
    const headers = { 'Authorization': `Bearer ${key}` };
    const b = request.body;

    // Model is a path like "google/veo3.1/text-to-video" or "wavespeed-ai/wan-2.2/t2v-720p".
    const modelPath = String(b.model || '').replace(/^\/+|\/+$/g, '');
    if (!/^[\w.-]+(\/[\w.-]+)+$/.test(modelPath)) {
        throw new HttpError(400, `Invalid WaveSpeed model path: ${modelPath}`);
    }

    // Each WaveSpeed model has its own schema; extra params override and `null` removes a field.
    const merged = {
        prompt: b.prompt,
        negative_prompt: b.negative,
        duration: b.seconds ? Number(b.seconds) : undefined,
        aspect_ratio: b.aspect,
        resolution: b.resolution,
        seed: b.seed,
        ...(b.extra || {}),
    };
    const body = withoutNulls(merged);

    console.info('[scene-video] WaveSpeed submit', modelPath, { ...body, prompt: `${String(body.prompt).slice(0, 80)}…` });
    const submit = await fetchJson(`${WS_BASE}/${modelPath}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    }, 'WaveSpeed submit');

    const id = submit?.data?.id;
    if (!id) {
        throw new HttpError(502, `WaveSpeed returned no prediction id: ${JSON.stringify(submit).slice(0, 500)}`);
    }
    const resultUrl = `${WS_BASE}/predictions/${encodeURIComponent(id)}/result`;
    const started = Date.now();

    for (let attempt = 0; Date.now() - started < POLL_TIMEOUT_MS; attempt++) {
        await sleep(Math.min(2000 + attempt * 500, 8000));
        if (signal.aborted) throw new HttpError(499, 'Aborted by client');

        const result = await fetchJson(resultUrl, { headers, signal }, 'WaveSpeed poll');
        const data = result?.data ?? {};
        console.debug(`[scene-video] WaveSpeed job ${id}: ${data.status}`);

        if (data.status === 'completed') {
            const output = (data.outputs || []).map(o => typeof o === 'string' ? o : o?.url).find(Boolean);
            if (!output) throw new HttpError(502, 'WaveSpeed returned no outputs');
            return downloadBase64(output, {}, signal);
        }
        if (['failed', 'cancelled', 'timeout', 'deleted'].includes(data.status)) {
            throw new HttpError(502, `WaveSpeed job ${data.status}: ${data.error || ''}`);
        }
    }
    throw new HttpError(504, 'WaveSpeed video generation timed out');
}

// ---------- Router ----------

export async function init(router) {
    readSecret = await loadSecrets();

    router.get('/ping', (_req, res) => res.send({ ok: true, version: '0.1.0' }));

    router.post('/status', (request, res) => {
        res.send({
            openrouter: Boolean(readSecret(request.user.directories, SECRET_OPENROUTER)),
            wavespeed: Boolean(readSecret(request.user.directories, SECRET_WAVESPEED)),
        });
    });

    router.post('/openrouter/models', async (request, res) => {
        try {
            const key = getKey(request, SECRET_OPENROUTER, 'OpenRouter');
            const data = await fetchJson(`${OR_BASE}/videos/models`, {
                headers: { ...OR_HEADERS, 'Authorization': `Bearer ${key}` },
            }, 'OpenRouter models');
            res.send(data);
        } catch (error) {
            res.status(error.status || 500).send(error.message);
        }
    });

    router.post('/generate', async (request, res) => {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', () => controller.abort());

        try {
            const backend = request.body?.backend;
            const fn = { openrouter: generateOpenRouter, wavespeed: generateWaveSpeed }[backend];
            if (!fn) {
                throw new HttpError(400, `Unknown backend: ${backend}`);
            }
            if (!request.body.prompt) {
                throw new HttpError(400, 'Prompt is empty');
            }
            const result = await fn(request, controller.signal);
            res.send(result);
        } catch (error) {
            console.warn('[scene-video]', error.message);
            if (!res.headersSent) {
                res.status(error.status && error.status < 600 ? error.status : 500).send(error.message);
            }
        }
    });

    console.info('[scene-video] plugin loaded');
}

export default { info, init };
