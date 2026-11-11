// Defaults of the extension: presets (settings, prompts, cameras, sound, models), shared types and the helpers built on them.

export type * from './types';
export { AUDIO_MODES } from './presets/audio';
export { CAMERA_MODES } from './presets/cameras';
export { DEFAULT_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT_H3, PLAN_INSTRUCTION } from './presets/instructions';
export { LEGACY_NEGATIVE_HASHES, LEGACY_PROMPT_HASHES, PROMPTS_VERSION } from './presets/legacy';
export { H3_MODEL_PATTERN, MODEL_SUGGESTIONS } from './presets/models';
export { DEFAULT_SETTINGS } from './presets/settings';
export { promptHash } from './helpers/hash';
export { defaultLooks } from './helpers/looks';
export { shotRule } from './helpers/shots';
