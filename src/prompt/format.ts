// Prompt format selection and cleanup of the LLM output.

import { H3_MODEL_PATTERN } from '../defaults';
import type { PromptFormat, SceneVideoSettings } from '../defaults';

/** Resolves `auto` to a concrete format based on the selected backend and model. */
export function resolvePromptFormat(s: SceneVideoSettings): Exclude<PromptFormat, 'auto'> {
    if (s.promptFormat !== 'auto') return s.promptFormat;
    if (s.backend === 'comfy') return 'generic';
    return H3_MODEL_PATTERN.test(s.backends[s.backend].model) ? 'minimax-h3' : 'generic';
}

/** Light cleanup of LLM output that keeps markup such as H3's <d> tags. */
export function cleanLlmOutput(raw: string): string {
    return String(raw ?? '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/^\s*```[\w-]*\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim();
}

/** Cuts any preamble before the first field and fills in missing trailing fields. */
export function normalizeH3Prompt(text: string): string {
    // LLMs sometimes bold the field names.
    let out = text.replace(/\*\*(integrated_multimodal_description|overall_soundscape|non_diegetic_music)\*\*\s*:?/g, '$1:');
    const start = out.indexOf('integrated_multimodal_description:');
    if (start === -1) {
        throw new Error('The LLM response is missing "integrated_multimodal_description:". Edit the prompt or try again.');
    }
    out = out.slice(start).trim();
    if (!out.includes('overall_soundscape:')) {
        console.warn('[Scene Video] The H3 prompt has no overall_soundscape field');
    }
    if (!out.includes('non_diegetic_music:')) {
        out += '\n\nnon_diegetic_music: N/A';
    }
    return out;
}
