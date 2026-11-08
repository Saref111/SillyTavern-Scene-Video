export type BackendId = 'openrouter' | 'wavespeed' | 'comfy';

/** How the LLM formats the video prompt. `auto` picks `minimax-h3` for H3 models. */
export type PromptFormat = 'auto' | 'generic' | 'minimax-h3';

export interface BackendConfig {
    model: string;
    resolution: string;
    /** JSON object merged into the request body; `null` values remove a field. */
    extra: string;
}

/** single: one continuous shot; multi: several shots joined by cuts; auto: the LLM decides. */
export type ShotMode = 'single' | 'multi' | 'auto';

export interface SceneVideoSettings {
    promptsVersion?: number;
    enabled: boolean;
    autoGenerate: boolean;
    confirmPrompt: boolean;
    backend: BackendId;
    backends: Record<'openrouter' | 'wavespeed', BackendConfig>;
    audio: boolean;
    seconds: number;
    aspect: '9:16' | '16:9' | '1:1' | '3:4' | '4:3';
    shotMode: ShotMode;
    comfyUrl: string;
    comfyWorkflow: string;
    comfyFps: number;
    contextMessages: number;
    responseLength: number;
    promptFormat: PromptFormat;
    /** Instruction for the generic format. */
    systemPrompt: string;
    /** Instruction for the MiniMax H3 structured format. */
    systemPromptH3: string;
    styleSuffix: string;
    negativePrompt: string;
}

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

// Shared by both instructions. Long, detailed prompts make video models produce calm, almost still clips:
// many small details average out. Fewer, bigger and clearer actions and emotions work better.
const ACTION_RULES = `- Decide yourself what to show: read the LAST message and pick the 1–3 moments that matter most and look best on video. It can be the build-up, the peak, a reaction or the aftermath, whatever tells the scene best. Build the clip from them and leave the rest out.
- Be brief: about {{words}} words for the visual description. Video models turn long, detailed prompts into calm, almost still clips. Fewer, bigger, clearer things make a lively clip.
- Never use character names: video models do not know them. Describe each person by appearance in ONE short phrase (age range, gender, build, hair, clothing), then move on to what happens. Give the setting one short phrase too.
- Focus on at most two people, in a medium or medium close-up shot, with their faces turned toward the camera for most of the clip. Expressions cannot be seen from behind or from far away. Others get a brief mention or are left out.
- Give each person in focus ONE clear emotional change, written as a change: "her face shifts from shock to a wide grin", "his smile drops into a scowl", "her eyes well up and her chin trembles". Play emotions big and readable, like an expressive actor: wide-eyed surprise, an open-mouthed laugh, a deep frown, tears, a beaming smile. A static state ("glassy eyes", "lips parted", "a flushed face") is not an emotion on screen; always pair it with a change or a movement. Turn feelings and thoughts from the text into visible behavior: nervous → fidgets and glances away; angry → slams a palm on the table and leans in; happy → laughs and throws the head back.
- Give the clip 2–3 big, visible actions that use the head, arms and whole body: spins around, jumps up, throws the arms up, leans in fast, pulls back, shoves, hugs, points, slaps the table, stands up. Small details (fingertips, thumbs, jewelry, water drops, fabric) barely move on screen; skip them.
- Write in chronological order with "then", "as", "a moment later", so the clip has a start, a peak and a reaction, and the action fills all {{seconds}} seconds.
- Use strong, specific verbs (grabs, spins, flinches, bursts out laughing, shoves, waves). Avoid static verbs (stands, sits, is, looks at, holds) unless something else happens at the same time.
- People move and gesture while they speak, and the delivery is emotional: shouts, whispers, says through laughter, snaps, sobs. Listeners react visibly: a nod, an eye roll, a step back, a laugh.
- The person filming reacts too: the phone jolts, swings to follow someone, steps closer or back. Use slow, small camera moves only for calm moments.`;

export const DEFAULT_SYSTEM_PROMPT = `You turn a roleplay scene into a prompt for a text-to-video model.

The clip is {{seconds}} seconds long and is filmed on a smartphone by someone who is physically present in the scene (a bystander or one of the participants holding the phone).

The clip must be full of motion and emotion. Spend the words on what HAPPENS, not on how people and places look.

Rules:
${ACTION_RULES}
- {{shots}}
- If someone speaks, add at most one short line of dialogue in quotes and say who speaks it. Keep the dialogue in the language of the scene.
- Describe ambient sound.
- Write in English, as one paragraph. Output only the prompt, with no preamble.`;

// Condensed from MiniMax's "Video Prompt Writing Guide" (T2VA part):
// https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_base_en.md
export const DEFAULT_SYSTEM_PROMPT_H3 = `You write prompts for the MiniMax H3 text-to-video-with-audio model (T2VA mode). Turn the roleplay scene into ONE short clip filmed on a smartphone by someone physically present in the scene (a bystander or a participant holding the phone).

Clip length: {{seconds}} seconds. Aspect ratio: {{aspect}}.
Look: {{style}}

Output EXACTLY these three fields in English (dialogue keeps its original language). Output nothing else: no preamble, no markdown, no code fences.

integrated_multimodal_description: [Shot 1] ...

overall_soundscape: ...

non_diegetic_music: ...

## Action and emotion (most important)
${ACTION_RULES}

## integrated_multimodal_description
- This is the main body. Along the timeline, describe only what can be seen or heard: style and opening composition, each person's appearance and position, the location and key props, actions and reactions, camera motion, speech, and synchronized diegetic sounds.
- Begin [Shot 1] with the style and the opening composition, for example: "[Shot 1] Live-action, amateur vertical smartphone footage, a handheld medium shot frames ...".
- Film the moments you chose from the LAST message. {{shots}}
- Shot syntax: a later shot starts with a strictly increasing cut time inside the clip, such as "[Shot 2] At 00:03.500, the camera cuts to ...". The first shot never has a timestamp.
- Never use character names, because the model does not know them. Describe each person by concrete appearance: age range, gender, build, hair, clothing.
- Write camera motion as a natural sentence inside the shot: motion type, then amplitude and speed only when they matter. Motion types: zoom in/out, push in/pull out, pan left/right, truck left/right, tilt up/down, pedestal up/down, arc shot, tracking shot, static shot, shake slightly/strongly, POV, roll clockwise/counterclockwise. Amplitude: "with small amplitude" / "with large amplitude". Speed: "at slow speed" / "at fast speed". For a handheld phone, prefer slight shake, tracking, POV and small pans or zooms. The camera reacts to the action: it follows a person who moves, jolts when something startling happens, steps back when someone comes close. Examples: "The camera shakes slightly as the person filming steps back." "The camera pans right with small amplitude at slow speed, revealing the doorway."
- Speech: every person who speaks, sings or makes an off-screen voice gets a stable ID such as (S1) or (S2), kept across shots. People who never speak get no ID. Two speakers speaking together use (S1,S2). When a speaker first appears, describe who they are and how they sound: age, gender, on- or off-screen, pitch, timbre, speaking rate, accent. Put that description, the ID and the delivery OUTSIDE the tag. Put only the language tag and the spoken words INSIDE it:
  The young woman with a quiet, breathy voice (S1) whispers: <d>[English] I get off at the next station.</d>
- The person filming is off-screen. If they speak, describe them that way: The off-screen man holding the phone, with a low, amused voice (S2), says: <d>[Ukrainian] Ти це бачиш?</d>
- Take dialogue from the scene word for word and keep its original language, with the matching tag ([English], [Ukrainian], [Russian], [Japanese], ...). Do not translate or paraphrase it. If a line is too long for the clip, choose a shorter line from the scene; do not rewrite it. Use at most 1–2 short lines in {{seconds}} seconds. If the end of the clip cuts speech off, put <cutoff> at the cut point.
- Voice-over: "(S1) says in an off-screen voiceover: <d>[English] ...</d> while his lips remain completely closed."
- Visible text (signs, labels, phone screens) goes in English double quotes, copied verbatim.

## overall_soundscape
Write 1–4 English sentences in one paragraph covering ambient sound, physical action sounds and non-verbal human sounds (breathing, laughter, footsteps, fabric, impacts), plus how the phone microphone sounds (wind buffeting, handling noise, clipping on loud sounds). Do not repeat the dialogue here.

## non_diegetic_music
This is background music that only the audience hears. An amateur phone recording has none, so write "N/A". Music the characters can hear (a radio, a song in a bar) is diegetic and belongs in integrated_multimodal_description.

## Example
integrated_multimodal_description: [Shot 1] Live-action, amateur vertical smartphone footage, a handheld medium shot frames a smoky night kitchen, where a tall man in his thirties with messy dark hair and a grey hoodie frantically shakes a smoking frying pan. He flinches back from spitting oil, then spins toward the lens, his face shifting from panic to wide-eyed embarrassment. He jabs the spatula at the camera, and the man with a hoarse voice (S1) shouts through a cough: <d>[English] Don't film this, it's not burnt, it's crispy.</d> The phone jolts and zooms in on the blackened pancake as the off-screen young woman holding it, with a bright voice (S2), says through laughter: <d>[English] Crispy, sure.</d> The man throws his head back with a groan, then bursts out laughing and dumps the pancake into the sink.

overall_soundscape: Oil crackles and spits in the pan while a range hood hums loudly overhead. The man coughs twice, the spatula clatters against the pan, and the phone microphone picks up close, breathy laughter and handling noise as the camera shakes.

non_diegetic_music: N/A`;

// Hashes of earlier default prompts: settings that still hold one of them are upgraded to the current default.
export const PROMPTS_VERSION = 6;
export const LEGACY_PROMPT_HASHES: Record<'systemPrompt' | 'systemPromptH3' | 'negativePrompt', string[]> = {
    systemPrompt: ['75c0de', '1msuu0p', '1r6wejz', 'm1smbh', '109hgei'],
    systemPromptH3: ['1mkyst', '1jsid1g', '1tx33px', 'vvjs39', 'feeo66'],
    negativePrompt: ['1s2e4w5'],
};

export function promptHash(text: string): string {
    let x = 5381;
    for (let i = 0; i < text.length; i++) x = ((x * 33) ^ text.charCodeAt(i)) >>> 0;
    return x.toString(36);
}

export const H3_MODEL_PATTERN = /hailuo-3|minimax-h3|minimax\/h3/i;

export const DEFAULT_STYLE_SUFFIX = 'Amateur smartphone footage, handheld, slight camera shake, natural available light, auto-exposure and focus adjustments, mild motion blur, phone microphone ambient audio, no music, no subtitles, realistic, unedited raw clip.';

export const DEFAULT_NEGATIVE = 'static, frozen, motionless people, still image, slideshow, blank expression, mannequin pose, cinematic color grading, studio lighting, tripod, gimbal, text, watermark, subtitles, logo, cartoon, CGI, anime';

export const DEFAULT_SETTINGS: SceneVideoSettings = {
    enabled: true,
    autoGenerate: false,
    confirmPrompt: true,
    backend: 'openrouter',
    backends: {
        openrouter: { model: 'minimax/hailuo-3', resolution: '', extra: '' },
        wavespeed: { model: 'wavespeed-ai/minimax-h3/text-to-video', resolution: '768p', extra: '' },
    },
    audio: true,
    seconds: 6,
    aspect: '9:16',
    shotMode: 'single',
    comfyUrl: 'http://127.0.0.1:8188',
    comfyWorkflow: '',
    comfyFps: 24,
    contextMessages: 4,
    responseLength: 700,
    promptFormat: 'auto',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    systemPromptH3: DEFAULT_SYSTEM_PROMPT_H3,
    styleSuffix: DEFAULT_STYLE_SUFFIX,
    negativePrompt: DEFAULT_NEGATIVE,
};

/** Text for the {{shots}} placeholder, by prompt format and shot mode. */
export function shotRule(mode: ShotMode, h3: boolean, seconds: number): string {
    const max = Math.max(2, Math.min(4, Math.floor(seconds / 2)));
    const range = max > 2 ? `2–${max}` : '2';
    if (h3) {
        switch (mode) {
            case 'single': return 'Use ONE continuous shot: a single [Shot 1] with no cuts. To change distance or angle, use camera motion instead of a cut.';
            case 'multi': return `Use ${range} shots, like several short phone recordings joined together: each shot is a different moment, place or angle, with its own opening composition, actions and camera motion. Give each shot at least about 2 seconds. Keep people's descriptions and speaker IDs consistent across shots.`;
            case 'auto': return `Decide the number of shots yourself: ONE continuous shot ([Shot 1] only) when the moments happen in one place and flow into each other, or ${range} shots, like short phone recordings joined together, when they are separated in time or place. Give each shot at least about 2 seconds. Keep people's descriptions and speaker IDs consistent across shots.`;
        }
    }
    switch (mode) {
        case 'single': return 'Show ONE continuous shot with no cuts. To change distance or angle, move the phone instead of cutting.';
        case 'multi': return `Show ${range} short shots in order, like phone recordings joined together. Start every shot after the first with "Cut to:" and give it its own framing, action and camera movement. Each shot lasts at least about 2 seconds.`;
        case 'auto': return `Decide the number of shots yourself: ONE continuous shot when the moments happen in one place and flow into each other, or ${range} short shots joined by "Cut to:" when they are separated in time or place. Each shot lasts at least about 2 seconds.`;
    }
}
