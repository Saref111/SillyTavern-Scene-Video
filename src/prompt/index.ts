// Writes the video prompt for a message: optional planning step, then the prompt itself.

import { PLAN_INSTRUCTION } from '../defaults';
import type { SceneVideoSettings } from '../defaults';
import { look } from '../core/settings';
import { cleanText } from '../core/text';
import { cleanLlmOutput, normalizeH3Prompt, resolvePromptFormat } from './format';
import { callLlm } from './llm';
import { buildSceneContext } from './scene';
import { applyTemplate } from './template';

export { resolvePromptFormat } from './format';

export async function writeVideoPrompt(messageId: number, s: SceneVideoSettings, focus?: string, direction?: string): Promise<string> {
    const format = resolvePromptFormat(s);
    const h3 = format === 'minimax-h3';
    const system = applyTemplate(h3 ? s.systemPromptH3 : s.systemPrompt, s, h3);
    const scene = buildSceneContext(messageId, s, focus, direction);

    let plan = '';
    if (s.twoStep) {
        const planSystem = applyTemplate(PLAN_INSTRUCTION, s, h3, false) + system;
        plan = cleanLlmOutput(await callLlm(s, planSystem, `${scene}\n\nWrite the plan now.`, 500));
        console.debug('[Scene Video] plan', plan);
    }
    const task = plan
        ? `${scene}\n\n[PLAN for this clip]\n${plan}\n\nWrite the video prompt now. Follow the plan and the rules.`
        : `${scene}\n\nWrite the video prompt now.`;
    const raw = await callLlm(s, system, task, s.responseLength);

    const text = cleanLlmOutput(raw);
    if (!text) throw new Error('The LLM returned an empty video prompt.');
    if (h3) return normalizeH3Prompt(text);
    return cleanText(text).replace(/^["'«]|["'»]$/g, '').replace(/^(video )?prompt:\s*/i, '').trim();
}

/** The generic format gets the style suffix appended. H3 has the style inside [Shot 1]. */
export function buildFinalPrompt(prompt: string, s: SceneVideoSettings): string {
    if (resolvePromptFormat(s) === 'minimax-h3') return prompt;
    const style = look(s).style.trim();
    return style ? `${prompt}\n\n${style}` : prompt;
}
