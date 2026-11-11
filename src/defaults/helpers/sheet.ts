// Character sheet prompts: the fixed layout around the person's description.

import { H3_MODEL_PATTERN } from '../presets/models';
import { SHEET_FROM_TEXT_H3, SHEET_FROM_TEXT_PLAIN, SHEET_LAYOUT } from '../presets/cards';

/** Prompt for drawing a sheet from a description; MiniMax H3 models get their structured format. */
export function sheetFromTextPrompt(description: string, model: string): string {
    if (H3_MODEL_PATTERN.test(model)) {
        return SHEET_FROM_TEXT_H3.replace('{{layout}}', SHEET_LAYOUT).replace('{{description}}', description);
    }
    const layout = SHEET_LAYOUT.replaceAll('<CHARACTER>\'s', 'the character\'s').replaceAll('<CHARACTER>', 'the character');
    return SHEET_FROM_TEXT_PLAIN.replace('{{layout}}', layout.charAt(0).toUpperCase() + layout.slice(1)).replace('{{description}}', description);
}
