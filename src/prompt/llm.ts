// LLM requests through the chat connection or a Connection Manager profile.

import type { SceneVideoSettings } from '../defaults';
import { ctx } from '../core/context';

/** Sends one system + user request, through the chosen connection profile or the current chat connection. */
export async function callLlm(s: SceneVideoSettings, system: string, user: string, maxTokens: number): Promise<string> {
    const c = ctx();
    if (!s.promptProfile) {
        return c.generateRaw({ systemPrompt: system, prompt: user, responseLength: maxTokens });
    }
    const service = c.ConnectionManagerRequestService;
    if (!service) throw new Error('Connection profiles are not available in this SillyTavern version.');
    const result = await service.sendRequest(
        s.promptProfile,
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        maxTokens,
        { stream: false, extractData: true, includePreset: true, includeInstruct: true },
    );
    return typeof result === 'string' ? result : String(result?.content ?? '');
}
