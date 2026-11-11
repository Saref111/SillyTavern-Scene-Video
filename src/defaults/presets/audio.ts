// Sound modes and their rules for each prompt format.

import type { AudioMode } from '../types';

export const AUDIO_MODES: Record<AudioMode, { label: string; generic: string; h3: string }> = {
    full: {
        label: 'Dialogue and ambient sound',
        generic: 'If someone speaks, add one or two short lines of dialogue in quotes, taken word for word from the scene in its original language, and say who speaks and how. Describe ambient and action sounds.',
        h3: 'Dialogue and sound as described in the sections below.',
    },
    dialogue: {
        label: 'Dialogue only',
        generic: 'Speech is the focus: add one or two short lines of dialogue in quotes, taken word for word from the scene in its original language, and say who speaks and how. Describe no other sounds apart from a quiet room tone.',
        h3: 'Speech is the focus: include 1–2 lines of dialogue as described below. In overall_soundscape, write only a quiet room tone with no loud effects.',
    },
    ambient: {
        label: 'Ambient sound, no speech',
        generic: 'Nobody speaks: write no dialogue. Show feelings through actions and non-verbal sounds (laughter, gasps, sighs), and describe ambient and action sounds.',
        h3: 'Nobody speaks: write no <d> tags and no speech, and give no speaker IDs. Show feelings through actions and non-verbal sounds (laughter, gasps, sighs, footsteps) in overall_soundscape.',
    },
    none: {
        label: 'No sound',
        generic: 'The clip is silent: write no dialogue and no sound descriptions.',
        h3: 'The clip is silent: write no <d> tags and no speech, give no speaker IDs, and write "overall_soundscape: N/A".',
    },
};
