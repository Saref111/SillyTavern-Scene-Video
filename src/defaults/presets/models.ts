// Known video models.

/** Suggestions for the model field. Users can type any model id. */
export const MODEL_SUGGESTIONS: Record<'openrouter' | 'wavespeed', string[]> = {
    openrouter: [
        'minimax/hailuo-3',
        'minimax/hailuo-3-max',
        'google/veo-3.1',
        'alibaba/wan-2.7',
        'bytedance/seedance-2.0',
    ],
    wavespeed: [
        'wavespeed-ai/minimax-h3/text-to-video',
        'google/veo3.1/text-to-video',
        'wavespeed-ai/ltx-2.5/text-to-video',
        'pruna-ai/p-video/text-to-video',
    ],
};

/** Models that get the MiniMax H3 structured prompt format. */
export const H3_MODEL_PATTERN = /hailuo-3|minimax-h3|minimax\/h3/i;
