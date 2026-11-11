// SillyTavern server plugin for Scene Video.
// It proxies OpenRouter and WaveSpeed video APIs so that API keys stay in the
// SillyTavern secret store and never reach the browser.
//
// Install: copy (or symlink) this folder to <SillyTavern>/plugins/scene-video
// and set `enableServerPlugins: true` in config.yaml.

import crypto from 'node:crypto';
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
/** WaveSpeed's model catalog per API key, cached for an hour. */
const wavespeedModelsCache = new Map();
const WAVESPEED_MODELS_CACHE_MS = 60 * 60 * 1000;
// Reference pictures need public URLs: they go to uguu.se, which deletes files after 3 hours.
const IMAGE_HOST_URL = 'https://uguu.se/upload';
const IMAGE_HOST_CACHE_MS = 2 * 60 * 60 * 1000;
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
    else if (contentType.includes('png') || /\.png(\?|$)/i.test(url)) format = 'png';
    else if (contentType.includes('jpeg') || /\.jpe?g(\?|$)/i.test(url)) format = 'jpg';
    else if (contentType.includes('webp') || /\.webp(\?|$)/i.test(url)) format = 'webp';
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

// ---------- Reference pictures ----------

/** sha1 of the image -> { url, at }, so the same card isn't uploaded again for every clip. */
const hostedImages = new Map();

async function hostImage({ data, format }, signal) {
    const buffer = Buffer.from(String(data || ''), 'base64');
    if (!buffer.length) throw new HttpError(400, 'A reference picture is empty');
    const hash = crypto.createHash('sha1').update(buffer).digest('hex');
    const cached = hostedImages.get(hash);
    if (cached && Date.now() - cached.at < IMAGE_HOST_CACHE_MS) return cached.url;

    const ext = /^(png|jpe?g|webp)$/i.test(format) ? format.toLowerCase().replace('jpeg', 'jpg') : 'png';
    const form = new FormData();
    form.append('files[]', new Blob([buffer], { type: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` }), `card-${hash.slice(0, 10)}.${ext}`);
    const result = await fetchJson(IMAGE_HOST_URL, { method: 'POST', body: form, signal }, 'Reference picture upload (uguu.se)');
    const url = result?.files?.[0]?.url;
    if (!url) throw new HttpError(502, `uguu.se returned no URL: ${JSON.stringify(result).slice(0, 300)}`);
    hostedImages.set(hash, { url, at: Date.now() });
    return url;
}

async function hostReferences(references, signal) {
    if (!Array.isArray(references) || !references.length) return [];
    const urls = [];
    for (const ref of references.slice(0, 3)) urls.push(await hostImage(ref, signal));
    console.info('[scene-video] Reference pictures', urls);
    return urls;
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
        input_references: b.referenceUrls?.length
            ? b.referenceUrls.map(url => ({ type: 'image_url', image_url: { url } }))
            : undefined,
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
    // With reference pictures a text-to-video path switches to the model's reference-to-video endpoint.
    let modelPath = String(b.model || '').replace(/^\/+|\/+$/g, '');
    if (b.referenceUrls?.length) modelPath = modelPath.replace('text-to-video', 'reference-to-video');
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
        reference_images: b.referenceUrls?.length ? b.referenceUrls : undefined,
        ...(b.extra || {}),
    };
    const body = withoutNulls(merged);
    return runWaveSpeed(modelPath, body, headers, signal);
}

/** Submits a WaveSpeed prediction, waits for it and downloads the first output. */
async function runWaveSpeed(modelPath, body, headers, signal) {
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
    throw new HttpError(504, 'WaveSpeed generation timed out');
}

/** Draws an appearance card with a WaveSpeed text-to-image model. */
// A card picture's shape: the aspect ratio and resolution tier chosen in the cards popup. WaveSpeed image
// models take them differently: as aspect_ratio + resolution (MiniMax H3, Krea…) or as a size in pixels
// (Seedream…). The model's own documentation lists its parameters, so it's read once per model.
const RESOLUTION_MEGAPIXELS = { '1k': 1, '1.5k': 2.4, '2k': 4 };
const imageParamsCache = new Map();

function optionsOf(doc, param) {
    const at = doc.indexOf(`**\`${param}\`**`);
    if (at < 0) return null;
    const next = doc.indexOf('- **`', at + 5);
    const section = doc.slice(at, next < 0 ? undefined : next);
    const line = section.match(/Options:\s*(.+)/);
    return line ? [...line[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
}

async function imageShape(modelPath, aspect, resolution, signal) {
    if (!imageParamsCache.has(modelPath)) {
        let doc = '';
        try {
            const res = await fetch(`https://wavespeed.ai/models/${modelPath}/llms.txt`, { signal });
            if (res.ok) doc = await res.text();
        } catch {
            // no documentation: fall back to the common parameters below
        }
        imageParamsCache.set(modelPath, doc);
    }
    const doc = imageParamsCache.get(modelPath);
    const shape = {};
    const [aw, ah] = String(aspect || '16:9').split(':').map(Number);
    const ratio = aw > 0 && ah > 0 ? aw / ah : 16 / 9;
    const tier = RESOLUTION_MEGAPIXELS[resolution] ? resolution : '1k';
    const ratios = optionsOf(doc, 'aspect_ratio');
    const value = r => { const [w, h] = r.split(':').map(Number); return w / h; };
    if (ratios?.length) {
        // The listed ratio closest to the requested one; on a tie the taller one leaves more room for the full body.
        shape.aspect_ratio = ratios.filter(r => /^\d+:\d+$/.test(r))
            .sort((a, b) => Math.abs(value(a) - ratio) - Math.abs(value(b) - ratio) || value(a) - value(b))[0];
    } else if (doc.includes('**`size`**')) {
        const pixels = RESOLUTION_MEGAPIXELS[tier] * 1024 * 1024;
        const height = Math.round(Math.sqrt(pixels / ratio) / 64) * 64;
        shape.size = `${Math.round(height * ratio / 64) * 64}*${height}`;
    } else {
        shape.aspect_ratio = `${aw}:${ah}`;
    }
    const resolutions = optionsOf(doc, 'resolution');
    if (resolutions?.length) shape.resolution = resolutions.includes(tier) ? tier : resolutions[0];
    if (optionsOf(doc, 'output_format')?.includes('png')) shape.output_format = 'png';
    return shape;
}

async function generateWaveSpeedImage(request, signal) {
    const key = getKey(request, SECRET_WAVESPEED, 'WaveSpeed');
    const b = request.body;
    const modelPath = String(b.model || '').replace(/^\/+|\/+$/g, '');
    if (!/^[\w.-]+(\/[\w.-]+)+$/.test(modelPath)) {
        throw new HttpError(400, `Invalid WaveSpeed model path: ${modelPath}`);
    }
    const shape = await imageShape(modelPath, b.aspect, b.resolution, signal);
    console.info('[scene-video] card image', modelPath, JSON.stringify(shape));
    const body = withoutNulls({ prompt: b.prompt, ...shape, ...(b.extra || {}) });
    return runWaveSpeed(modelPath, body, { 'Authorization': `Bearer ${key}` }, signal);
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
            // The list is public; the key is sent when there is one.
            const key = readSecret(request.user.directories, SECRET_OPENROUTER);
            const data = await fetchJson(`${OR_BASE}/videos/models`, {
                headers: { ...OR_HEADERS, ...(key ? { 'Authorization': `Bearer ${key}` } : {}) },
            }, 'OpenRouter models');
            res.send(data);
        } catch (error) {
            res.status(error.status || 500).send(error.message);
        }
    });

    // WaveSpeed's catalog depends on the account, so it needs the key. Only models that take a prompt are
    // listed: text-to-video (the extension switches to reference-to-video for cards itself) or, with
    // { kind: 'image' }, text-to-image for drawing cards.
    router.post('/wavespeed/models', async (request, res) => {
        try {
            const key = getKey(request, SECRET_WAVESPEED, 'WaveSpeed');
            let catalog = wavespeedModelsCache.get(key);
            if (!catalog || Date.now() - catalog.at >= WAVESPEED_MODELS_CACHE_MS) {
                const data = await fetchJson(`${WS_BASE}/models`, { headers: { 'Authorization': `Bearer ${key}` } }, 'WaveSpeed models');
                catalog = { at: Date.now(), models: Array.isArray(data?.data) ? data.data : [] };
                wavespeedModelsCache.set(key, catalog);
            }
            const type = request.body?.kind === 'image' ? 'text-to-image' : 'text-to-video';
            const pattern = new RegExp(`/${type}(-[\\w-]+)?$`);
            const models = catalog.models
                .filter(m => m?.model_id && (m.type === type || pattern.test(m.model_id)))
                .map(m => ({ id: m.model_id, name: m.name || m.model_id, price: typeof m.base_price === 'number' ? m.base_price : null }))
                .sort((a, b) => a.id.localeCompare(b.id));
            res.send(models);
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
            request.body.referenceUrls = await hostReferences(request.body.references, controller.signal);
            const result = await fn(request, controller.signal);
            res.send(result);
        } catch (error) {
            console.warn('[scene-video]', error.message);
            if (!res.headersSent) {
                res.status(error.status && error.status < 600 ? error.status : 500).send(error.message);
            }
        }
    });

    router.post('/wavespeed/image', async (request, res) => {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', () => controller.abort());
        try {
            if (!request.body?.prompt) throw new HttpError(400, 'Prompt is empty');
            res.send(await generateWaveSpeedImage(request, controller.signal));
        } catch (error) {
            console.warn('[scene-video]', error.message);
            if (!res.headersSent) res.status(error.status && error.status < 600 ? error.status : 500).send(error.message);
        }
    });

    console.info('[scene-video] plugin loaded');
}

export default { info, init };
