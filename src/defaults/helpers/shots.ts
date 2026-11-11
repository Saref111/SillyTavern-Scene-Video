import type { ShotMode } from '../types';

/** Text for the {{shots}} placeholder, by prompt format and shot mode. */
export function shotRule(mode: ShotMode, h3: boolean, seconds: number): string {
    const max = Math.max(2, Math.min(4, Math.floor(seconds / 2)));
    const range = max > 2 ? `2–${max}` : '2';
    if (h3) {
        switch (mode) {
            case 'single': return 'Use ONE continuous shot: a single [Shot 1] with no cuts. To change distance or angle, use camera motion instead of a cut.';
            case 'multi': return `Use ${range} shots, like separate recordings joined together: each shot is a different moment, place or angle, with its own opening composition, actions and camera motion. Give each shot at least about 2 seconds. Keep people's descriptions and speaker IDs consistent across shots.`;
            case 'auto': return `Decide the number of shots yourself: ONE continuous shot ([Shot 1] only) when the moments happen in one place and flow into each other, or ${range} shots, like separate recordings joined together, when they are separated in time or place or when a clear setup → peak → reaction reads better with cuts. Give each shot at least about 2 seconds. Keep people's descriptions and speaker IDs consistent across shots.`;
        }
    }
    switch (mode) {
        case 'single': return 'Show ONE continuous shot with no cuts. To change distance or angle, move the camera instead of cutting.';
        case 'multi': return `Show ${range} short shots in order, like separate recordings joined together. Start every shot after the first with "Cut to:" and give it its own framing, action and camera movement. Each shot lasts at least about 2 seconds.`;
        case 'auto': return `Decide the number of shots yourself: ONE continuous shot when the moments happen in one place and flow into each other, or ${range} short shots joined by "Cut to:" when they are separated in time or place or when a clear setup → peak → reaction reads better with cuts. Each shot lasts at least about 2 seconds.`;
    }
}
