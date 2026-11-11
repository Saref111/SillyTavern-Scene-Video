/* eslint-disable @typescript-eslint/no-explicit-any */
// Main flow: settings popup, prompt, review, video generation, saving and attaching.

import { CAMERA_MODES } from '../defaults';
import { generateVideo } from '../backends';
import { cardCandidates, loadReferences, pickCards } from '../cards/pick';
import type { CardRef } from '../cards/pick';
import { chatPeople } from '../cards/people';
import { setBusy } from '../chat/button';
import { ctx } from '../core/context';
import { look, persistClipSettings, settings } from '../core/settings';
import { escapeHtml, truncate } from '../core/text';
import { buildFinalPrompt, resolvePromptFormat, writeVideoPrompt } from '../prompt';
import { showPreflight } from '../ui/preflight';
import { reviewPrompt } from '../ui/review';
import { syncSettingsUI } from '../ui/settings';
import { attachVideo, uploadVideo } from './media';

/** Message id -> abort controller of the running generation. */
export const running = new Map<number, AbortController>();

export interface RunOptions {
    /** Ready prompt; skips the LLM step. */
    prompt?: string;
    /** Skip the review popup. */
    quiet?: boolean;
    /** Fragment of the message to film instead of letting the LLM choose. */
    focus?: string;
    /** Free-form direction for this clip, passed to the LLM. */
    direction?: string;
}

export async function generateSceneVideo(messageId: number, opts: RunOptions = {}): Promise<string> {
    const c = ctx();
    let s = settings();
    const message = c.chat[messageId];
    if (!message) throw new Error(`Message #${messageId} not found`);
    if (running.has(messageId)) throw new Error('A video is already being generated for this message.');

    const controller = new AbortController();
    running.set(messageId, controller);
    setBusy(messageId, true);
    const chatId = c.getCurrentChatId();
    let toast: any = null;

    try {
        let prompt = opts.prompt?.trim();
        let focus = opts.focus?.trim() || undefined;
        let direction = opts.direction?.trim() || undefined;
        let allowedCards: string[] | undefined;
        if (s.preflight && !opts.quiet) {
            const cards = s.useCards
                ? (await chatPeople()).filter(p => s.cards[p.key]?.image).map(p => ({ key: p.key, name: p.name, persona: p.kind === 'persona' }))
                : [];
            const choice = await showPreflight({ settings: s, focus, direction, needsPrompt: !prompt, cards });
            if (!choice) return '';
            ({ settings: s, focus, direction } = choice);
            allowedCards = choice.cardKeys;
            if (choice.saveAsDefault) {
                persistClipSettings(s);
                syncSettingsUI();
            }
        }
        // Appearance cards: only when the LLM writes the prompt, since it has to refer to them.
        let refs: CardRef[] = [];
        if (!prompt && s.useCards && s.backend !== 'comfy') {
            let candidates = await cardCandidates(s);
            if (allowedCards) candidates = candidates.filter(r => allowedCards.includes(r.person.key));
            if (candidates.length) {
                toast = toastr.info('Choosing appearance cards…', 'Scene Video', { timeOut: 0, extendedTimeOut: 0 });
                refs = await pickCards(messageId, s, candidates, focus, direction);
                toastr.clear(toast);
            }
        }
        if (!prompt) {
            toast = toastr.info(focus ? 'Writing the video prompt for the selected fragment…' : 'Writing the video prompt…', 'Scene Video', { timeOut: 0, extendedTimeOut: 0 });
            prompt = await writeVideoPrompt(messageId, s, focus, direction, refs);
            toastr.clear(toast);
        }

        const isH3 = resolvePromptFormat(s) === 'minimax-h3';
        if (s.confirmPrompt && !opts.quiet) {
            const note = isH3
                ? 'MiniMax H3 structured format. Keep the three fields and the <code>&lt;d&gt;</code> tags.'
                : 'The style suffix is added automatically.';
            const camera = CAMERA_MODES[s.cameraMode]?.label ?? s.cameraMode;
            const fragment = focus ? `<br>Selected fragment: <i>«${escapeHtml(truncate(focus, 300))}»</i>` : '';
            const cardNote = refs.length
                ? `<br>Appearance cards: ${refs.map((r, i) => `<b>${isH3 ? `&lt;Picture ${i + 1}&gt;` : `reference image ${i + 1}`}</b> ${escapeHtml(r.person.name)}`).join(', ')}`
                : '';
            const clip = s;
            const edited = await reviewPrompt(prompt, `${note} Backend: <b>${s.backend}</b>, camera: <b>${camera}</b>.${fragment}${cardNote}`, isH3,
                () => writeVideoPrompt(messageId, clip, focus, direction, refs));
            if (edited === null || edited === undefined || !String(edited).trim()) {
                return '';
            }
            prompt = String(edited).trim();
        }

        const finalPrompt = buildFinalPrompt(prompt, s);
        toast = toastr.info('Generating the video. This usually takes 1–5 minutes.', 'Scene Video', { timeOut: 0, extendedTimeOut: 0 });

        const references = refs.length ? await loadReferences(refs) : undefined;
        const video = await generateVideo({ prompt: finalPrompt, negative: look(s).negative, settings: s, signal: controller.signal, references });
        const url = await uploadVideo(video.data, video.format);
        toastr.clear(toast);

        if (c.getCurrentChatId() !== chatId || ctx().chat[messageId] !== message) {
            toastr.warning(`The chat changed during generation. The video was saved here: ${url}`, 'Scene Video');
            return url;
        }

        attachVideo(messageId, url, prompt);
        await c.saveChat();
        toastr.success('The video was added to the message.', 'Scene Video');
        return url;
    } catch (error: any) {
        if (toast) toastr.clear(toast);
        if (controller.signal.aborted) {
            toastr.info('Video generation was cancelled.', 'Scene Video');
            return '';
        }
        console.error('[Scene Video]', error);
        toastr.error(String(error?.message ?? error), 'Scene Video failed', { timeOut: 15000 });
        throw error;
    } finally {
        running.delete(messageId);
        setBusy(messageId, false);
    }
}
