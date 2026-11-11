import { CAMERA_MODES } from '../presets/cameras';
import type { CameraMode, Look } from '../types';

/** A fresh copy of every camera's default look, so edits never touch the defaults. */
export function defaultLooks(): Record<CameraMode, Look> {
    return Object.fromEntries(Object.entries(CAMERA_MODES).map(([k, v]) => [k, { ...v.look }])) as Record<CameraMode, Look>;
}
