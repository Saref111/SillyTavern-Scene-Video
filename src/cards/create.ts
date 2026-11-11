// Making an appearance card (a character sheet): drawn from an LLM-written description by
// SillyTavern's image generation or a WaveSpeed model, or taken as is from a file or the avatar.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { CARD_DEFAULT_UNDERWEAR, CARD_NUDITY, CARD_UNDERWEAR, CARD_PROMPT_INSTRUCTION, CARD_PROMPT_VERSION, cardPixels, sheetFromTextPrompt } from '../defaults';
import { generateCardImage } from '../backends';
import { ctx } from '../core/context';
import { settings } from '../core/settings';
import { cleanText, truncate } from '../core/text';
import { cleanLlmOutput } from '../prompt/format';
import { callLlm } from '../prompt/llm';
import type { Person } from './people';
import { setCard } from './store';

const CARD_FOLDER = 'scene-video-cards';

/** Recent messages, so the LLM can find details about an extra person of the story. */
function recentStory(count = 8): string {
    const chat = ctx().chat ?? [];
    return chat.slice(-count).filter((m: any) => !m.is_system).map((m: any) => `${m.name}: ${truncate(cleanText(m.mes), 1200)}`).join('\n\n');
}

export async function writeCardPrompt(person: Person): Promise<string> {
    const description = truncate(cleanText(person.description), 3000);
    let task: string;
    if (person.kind === 'extra') {
        task = `[Person: ${person.name}]\n${description || 'No description given: take the appearance from the story below, and invent nothing that contradicts it.'}\n\n[Recent story, for details about ${person.name}]\n${recentStory()}`;
    } else {
        task = `[Person description]\n${description || 'No description. Draw an ordinary adult.'}`;
    }
    const raw = await callLlm(settings(), CARD_PROMPT_INSTRUCTION, `${task}\n\nWrite the description now.`, 400);
    const text = cleanText(cleanLlmOutput(raw)).replace(/^["'«]|["'»]$/g, '').trim();
    if (!text) throw new Error('The LLM returned an empty description.');
    return withUnderwear(text);
}

/** The card always shows underwear: sentences about nudity are dropped and default underwear is added if none is named. */
export function withUnderwear(description: string): string {
    const sentences = description.match(/[^.!?]+[.!?]*/g) ?? [description];
    let text = sentences.filter(s => !CARD_NUDITY.test(s)).join('').trim();
    if (!CARD_UNDERWEAR.test(text)) {
        const man = /\b(man|male|boy|guy|he)\b/i.test(text) && !/\b(woman|female|girl|she)\b/i.test(text);
        text = `${text} ${man ? CARD_DEFAULT_UNDERWEAR.man : CARD_DEFAULT_UNDERWEAR.woman}`.trim();
    }
    return text;
}

/** Lets the user edit the image prompt; null when cancelled. */
export async function confirmCardPrompt(person: Person, prompt: string): Promise<string | null> {
    const c = ctx();
    const value = await c.Popup.show.input(`Appearance card: ${person.name}`, 'How the person looks. The character sheet layout is added automatically. Edit it if needed.', prompt, { rows: 8, wide: true, okButton: 'Draw' });
    const text = String(value ?? '').trim();
    return text || null;
}

async function saveImage(base64: string, format: string, person: Person): Promise<string> {
    const c = ctx();
    const res = await fetch('/api/images/upload', {
        method: 'POST',
        headers: c.getRequestHeaders(),
        body: JSON.stringify({
            image: base64,
            format: format || 'png',
            ch_name: CARD_FOLDER,
            filename: `${person.name}_${c.humanizedDateTime()}`.replace(/[^\w-]+/g, '_'),
        }),
    });
    if (!res.ok) throw new Error(`Saving the card failed: ${await res.text()}`);
    return (await res.json()).path;
}

async function blobToBase64(blob: Blob): Promise<{ data: string; format: string }> {
    const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
    const [head, data] = dataUrl.split(',');
    const format = (head.match(/image\/(\w+)/)?.[1] ?? 'png').replace('jpeg', 'jpg');
    return { data, format };
}

export async function imageToBase64(url: string): Promise<{ data: string; format: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not read the picture ${url}: ${res.status}`);
    return blobToBase64(await res.blob());
}

/** Warns when an image model ignored the wide size, since a square sheet crowds the views. */
async function checkShape(url: string) {
    const img = new Image();
    img.src = url;
    try {
        await img.decode();
    } catch {
        return;
    }
    const [w, h] = settings().cardAspect.split(':').map(Number);
    if (img.naturalWidth < img.naturalHeight * Math.max(1.2, (w / h) * 0.8)) {
        toastr.warning(`The picture is ${img.naturalWidth}×${img.naturalHeight}, not the ${settings().cardAspect} shape: this model or source ignored it. The views may be crowded; another model or source may work better.`, 'Scene Video', { timeOut: 15000 });
    }
}

/** Draws with SillyTavern's Image Generation extension and its current source. */
export async function drawWithSillyTavern(person: Person, description: string) {
    const prompt = sheetFromTextPrompt(description, '');
    const command = ctx().SlashCommandParser?.commands?.imagine;
    if (!command) throw new Error('Enable SillyTavern\'s Image Generation extension to draw cards with it.');
    // Calling the command directly avoids slash-command parsing of the prompt text.
    const s = settings();
    const { width, height } = cardPixels(s.cardAspect, s.cardResolution);
    const url = await command.callback({ quiet: 'true', gallery: 'false', width: String(width), height: String(height) }, prompt);
    if (!url) throw new Error('Image Generation returned no picture. Check its settings.');
    setCard(person.key, { image: String(url), prompt: description, promptVersion: CARD_PROMPT_VERSION });
    await checkShape(String(url));
}

export async function drawWithWaveSpeed(person: Person, description: string) {
    const s = settings();
    const model = s.cardImageModel;
    const image = await generateCardImage(sheetFromTextPrompt(description, model), model, s.cardAspect, s.cardResolution);
    const url = await saveImage(image.data, image.format, person);
    setCard(person.key, { image: url, prompt: description, promptVersion: CARD_PROMPT_VERSION });
    await checkShape(url);
}


export async function cardFromFile(person: Person, file: File) {
    const image = await blobToBase64(file);
    setCard(person.key, { image: await saveImage(image.data, image.format, person) });
}

export async function cardFromAvatar(person: Person) {
    const image = await imageToBase64(person.avatarUrl);
    setCard(person.key, { image: await saveImage(image.data, image.format, person) });
}
