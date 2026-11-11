// Chat event handlers: the message button and automatic generation for new messages.

import { ctx } from '../core/context';
import { settings } from '../core/settings';
import { generateSceneVideo, running } from '../generation';
import { syncButtons } from './button';
import { takeSelection } from './selection';

export async function onButtonClick(this: HTMLElement) {
    const messageId = Number($(this).closest('.mes').attr('mesid'));
    if (Number.isNaN(messageId)) return;

    const active = running.get(messageId);
    if (active) {
        const ok = await ctx().Popup.show.confirm('Scene Video', 'Cancel the video generation for this message?');
        if (ok) active.abort();
        return;
    }
    generateSceneVideo(messageId, { focus: takeSelection(messageId) }).catch(() => { /* already reported */ });
}

export function onCharacterMessageRendered(messageId: number, type: string) {
    syncButtons();
    const s = settings();
    if (!s.autoGenerate || type === 'extension' || type === 'first_message') return;
    const message = ctx().chat[messageId];
    if (!message || message.is_user || message.is_system) return;
    generateSceneVideo(Number(messageId)).catch(() => { /* already reported */ });
}
