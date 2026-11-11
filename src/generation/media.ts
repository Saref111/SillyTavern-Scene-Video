/* eslint-disable @typescript-eslint/no-explicit-any */
// Saving the generated video and attaching it to the chat message.

import { ctx } from '../core/context';

export async function uploadVideo(base64: string, format: string): Promise<string> {
    const c = ctx();
    const folder = c.groupId ? (c.groups.find((g: any) => g.id === c.groupId)?.name ?? 'group') : (c.name2 || 'scene-video');
    const res = await fetch('/api/images/upload', {
        method: 'POST',
        headers: c.getRequestHeaders(),
        body: JSON.stringify({
            image: base64,
            format: format || 'mp4',
            ch_name: folder,
            filename: `scene_${c.humanizedDateTime()}`.replace(/[^\w-]+/g, '_'),
        }),
    });
    if (!res.ok) throw new Error(`Saving the video failed: ${await res.text()}`);
    return (await res.json()).path;
}

export function attachVideo(messageId: number, url: string, prompt: string) {
    const c = ctx();
    const message = c.chat[messageId];
    if (!message.extra || typeof message.extra !== 'object') message.extra = {};
    c.ensureMessageMediaIsArray?.(message);
    if (!Array.isArray(message.extra.media)) message.extra.media = [];
    if (!message.extra.media.length && !message.extra.media_display) message.extra.media_display = 'gallery';

    message.extra.media.push({ url, type: 'video', title: prompt, source: 'generated' });
    message.extra.media_index = message.extra.media.length - 1;
    message.extra.inline_image = true;

    const element = $(`#chat .mes[mesid="${messageId}"]`);
    c.appendMediaToMessage(message, element);
}
