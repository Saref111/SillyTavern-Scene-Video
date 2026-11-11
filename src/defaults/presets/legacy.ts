// Prompt versioning: lets saved settings that still hold an old default be upgraded.

// Hashes of earlier default prompts: settings that still hold one of them are upgraded to the current default.
export const PROMPTS_VERSION = 11;
export const LEGACY_PROMPT_HASHES: Record<'systemPrompt' | 'systemPromptH3', string[]> = {
    systemPrompt: ['75c0de', '1msuu0p', '1r6wejz', 'm1smbh', '109hgei', '183ln5g', 'j5rg6i', '1bo6l48', '160obh9', '1nkz8g3'],
    systemPromptH3: ['1mkyst', '1jsid1g', '1tx33px', 'vvjs39', 'feeo66', '8sspc0', '5ygoy7', '1plpb1', '1qhhw9u', 'sddqdv'],
};
/** Earlier default negative prompts (before looks were split by camera mode). */
export const LEGACY_NEGATIVE_HASHES = ['1s2e4w5', 'aziall'];
