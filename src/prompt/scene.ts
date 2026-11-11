// The scene the LLM reads: character card, earlier messages, the message to film and the user's focus.

import type { SceneVideoSettings } from '../defaults';
import { ctx } from '../core/context';
import { cleanText, truncate } from '../core/text';

export function buildSceneContext(messageId: number, s: SceneVideoSettings, focus?: string, direction?: string): string {
    const c = ctx();
    const parts: string[] = [];

    try {
        const fields = c.getCharacterCardFields?.() ?? {};
        if (fields.description) parts.push(`[Character "${c.name2}" description]\n${truncate(cleanText(c.substituteParams(fields.description)), 2500)}`);
        if (fields.persona) parts.push(`[User "${c.name1}" description]\n${truncate(cleanText(c.substituteParams(fields.persona)), 1000)}`);
        if (fields.scenario) parts.push(`[Scenario]\n${truncate(cleanText(c.substituteParams(fields.scenario)), 1000)}`);
    } catch (error) {
        console.warn('[Scene Video] Could not read character card fields', error);
    }

    const history: string[] = [];
    for (let i = Math.max(0, messageId - s.contextMessages); i < messageId; i++) {
        const m = c.chat[i];
        if (!m || m.is_system) continue;
        history.push(`${m.name}: ${truncate(cleanText(m.mes), 1500)}`);
    }
    if (history.length) parts.push(`[Earlier messages]\n${history.join('\n\n')}`);

    const target = c.chat[messageId];
    if (focus) {
        parts.push(`[LAST message]\n${target.name}: ${truncate(cleanText(target.mes), 4000)}`);
        parts.push(`[FOCUS: the user selected this fragment of the last message. The clip must show exactly this moment; use the rest only as context]\n${truncate(focus, 1500)}`);
    } else {
        parts.push(`[LAST message — film this moment]\n${target.name}: ${truncate(cleanText(target.mes), 4000)}`);
    }
    if (direction) {
        parts.push(`[DIRECTION from the user for this clip: follow it even where it differs from your own choice]\n${truncate(direction, 1500)}`);
    }
    return parts.join('\n\n');
}
