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

/** Who or what records the clip. */
export type CameraMode = 'bystander' | 'pov' | 'selfie' | 'cctv' | 'cinematic';

/** What the clip sounds like. */
export type AudioMode = 'full' | 'dialogue' | 'ambient' | 'none';

export type Aspect = '9:16' | '16:9' | '1:1' | '3:4' | '4:3';

/** Aspect ratio, style and negative prompt, kept separately for each camera mode. */
export interface Look {
    aspect: Aspect;
    style: string;
    negative: string;
}

export interface SceneVideoSettings {
    promptsVersion?: number;
    enabled: boolean;
    autoGenerate: boolean;
    confirmPrompt: boolean;
    /** Show a popup with the per-clip settings before each generation. */
    preflight: boolean;
    backend: BackendId;
    backends: Record<'openrouter' | 'wavespeed', BackendConfig>;
    seconds: number;
    shotMode: ShotMode;
    cameraMode: CameraMode;
    audioMode: AudioMode;
    comfyUrl: string;
    comfyWorkflow: string;
    comfyFps: number;
    contextMessages: number;
    responseLength: number;
    /** Connection profile id for writing prompts; empty means the current chat connection. */
    promptProfile: string;
    /** Plan the clip in a first LLM call, then write the prompt from the plan. */
    twoStep: boolean;
    promptFormat: PromptFormat;
    /** Instruction for the generic format. */
    systemPrompt: string;
    /** Instruction for the MiniMax H3 structured format. */
    systemPromptH3: string;
    looks: Record<CameraMode, Look>;
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
const ACTION_RULES = `- Decide yourself what to show: read the LAST message and pick the 1–3 moments that matter most and look best on video. It can be the build-up, the peak, a reaction or the aftermath, whatever tells the scene best. Build the clip from them and leave the rest out. If a FOCUS fragment is given, show exactly that moment instead.
- When the source strongly emphasizes sexualized or exaggerated body/clothing details that are actively visible in the moment (bouncing breasts, tight fabric, cleavage, short skirt flashing, thighhigh dig, etc.), keep the most important of those visual details. Do not replace them with vague words like “curvy”. Write breast motion as a light "bounce" or "sway", never "jiggle", "heavy" or "heavily": video models turn weight and jiggle into a fat body.
- Clothing must stay consistent. When a top, bra, skirt or panties are important, name the garment clearly and keep it present for the whole clip (e.g. "thin white tanktop that stays on", "pink miniskirt", "striped panties"). Avoid phrases that only describe exposure ("spilling out", "barely contained") without also naming the clothing that is doing the containing.
- Be brief: about {{words}} words for the visual description. Video models turn long, detailed prompts into calm, almost still clips. Fewer, bigger, clearer things make a lively clip.
- Never use character names: video models do not know them. Describe each person in focus with a short, distinctive appearance block: age range, gender, build, hair, plus the 2–4 visual details that make them recognizable in the source (a distinctive outfit, color, accessory, hairstyle). Keep it under about 25 words, take the details from the source and invent none.
- Build is required and must state the actual weight, because video models fill a missing or vague build with a heavier body. Use concrete words: "slim", "slender", "petite", "toned", "athletic", "slim waist", "slender limbs". Translate vague source words instead of copying them: "curvy", "thick", "voluptuous", "full-figured", "soft" or "bombshell" → "slim with an hourglass figure, narrow waist"; large breasts → "large breasts on a slim frame". Write a heavy build ("plump", "chubby", "heavyset") only when the source states plainly that the person is overweight. Other people get a few words at most. Give the setting one short phrase too.
- Focus on at most two people, with their faces visible to the camera for most of the clip and as close as the camera allows. Expressions cannot be seen from behind or from far away; when the camera is far, show emotion through big body language. Others get a brief mention or are left out. When the reaction of onlookers is part of the moment (heads turn, a room falls silent), mention them briefly in the background, for example "several people turn to stare".
- Give each person in focus ONE clear emotional change, written as a change: "her face shifts from shock to a wide grin", "his smile drops into a scowl", "her eyes well up and her chin trembles". Play emotions big and readable, like an expressive actor: wide-eyed surprise, an open-mouthed laugh, a deep frown, tears, a beaming smile. A static state ("glassy eyes", "lips parted", "a flushed face") is not an emotion on screen; always pair it with a change or a movement. Turn feelings and thoughts from the text into visible behavior: nervous → fidgets and glances away; angry → slams a palm on the table and leans in; happy → laughs and throws the head back.
- Give the clip 2–3 big, visible actions that use the head, arms and whole body: spins around, jumps up, throws the arms up, leans in fast, pulls back, shoves, hugs, points, slaps the table, stands up. Small details (fingertips, thumbs, jewelry, water drops, fabric) barely move on screen; skip them.
- Write in chronological order with "then", "as", "a moment later", so the clip has a start, a peak and a reaction, and the action fills all {{seconds}} seconds.
- Use strong, specific verbs (grabs, spins, flinches, bursts out laughing, shoves, waves). Avoid static verbs (stands, sits, is, looks at, holds) unless something else happens at the same time.
- People move and gesture while they speak, and the delivery is emotional: shouts, whispers, says through laughter, snaps, sobs. Listeners react visibly: a nod, an eye roll, a step back, a laugh.
- Speech timing: in clips up to about 8 seconds, prefer ONE clear spoken line. Two lines need an action or reaction between them. Never merge separate utterances into one line.
- When the Camera rules allow movement, give the camera one decisive move that sells the peak of the clip: a quick push-in, a whip pan, a jolt.`;

export const DEFAULT_SYSTEM_PROMPT = `You turn a roleplay scene into a prompt for a text-to-video model.

The clip is {{seconds}} seconds long.

Camera: {{camera}}

Sound: {{audio}}

The clip must be full of motion and emotion. Spend the words on what HAPPENS, not on how people and places look.

Rules:
${ACTION_RULES}
- {{shots}}
- Follow the Camera and Sound rules above.
- Timeline (required): split the clip into timed segments that cover all {{seconds}} seconds. Begin with ONE short line that sets up the look, the people in focus and the setting. Then write at least {{beats}} segments, each on its own line, starting with its time range: "[0s-2s] ...", "[2s-4s] ...", up to "{{seconds}}s". Each segment lasts about 2–4 seconds and holds one main step: an action, a reaction, an emotional change or a spoken line, with the camera move and sounds that happen in it. A cut starts its segment with "Cut to:". When something must stay unchanged in later segments (a hand that keeps holding, clothing that stays on), say so again there.
- Write in English. Output only the prompt, with no preamble.

Example for a 6-second clip (scale the segments to {{seconds}} seconds; follow the Camera, Sound and Shots rules above where they differ):
{{example}}`;

// Condensed from MiniMax's "Video Prompt Writing Guide" (T2VA part):
// https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_base_en.md
export const DEFAULT_SYSTEM_PROMPT_H3 = `You write prompts for the MiniMax H3 text-to-video-with-audio model (T2VA mode). Turn the roleplay scene into ONE short clip.

Clip length: {{seconds}} seconds. Aspect ratio: {{aspect}}.
Look: {{style}}
Camera: {{camera}}
Sound: {{audio}}

Output EXACTLY these three fields in English (dialogue keeps its original language). Output nothing else: no preamble, no markdown, no code fences.

integrated_multimodal_description: [Shot 1] ...

overall_soundscape: ...

non_diegetic_music: ...

## Action and emotion (most important)
${ACTION_RULES}

## integrated_multimodal_description
- This is the main body. Along the timeline, describe only what can be seen or heard: style and opening composition, each person's appearance and position, the location and key props, actions and reactions, camera motion, speech, and synchronized diegetic sounds.
- Begin [Shot 1] with the Look and the opening composition, for example: "[Shot 1] Live-action, amateur vertical smartphone footage, a handheld medium shot frames ...".
- Film the moments you chose from the LAST message. {{shots}}
- Shot syntax: a later shot starts with its cut time, such as "[Shot 2] At 00:03.500, the camera cuts to ...". [Shot 1] starts at 00:00 and has no timestamp of its own, but its later beats do (see Timeline).

## Timeline (required)
- Write the clip as a timeline of beats, not one undivided paragraph. The opening of [Shot 1] is the first beat (00:00): the Look, the composition, the people, the setting and the first action. Every next beat is its OWN paragraph (separated by a blank line) that starts with its time: "At 00:02.000, ...". Use the mm:ss.mmm format.
- Write at least {{beats}} beats in total for {{seconds}} seconds, the 00:00 opening included. Times are strictly increasing and about 2–4 seconds apart, so the beats cover the WHOLE clip with no long gap. The last beat starts at least about 1.5 seconds before the end and shows how the clip ends; you may close it with the final pose at the end time, for example "... settling into position at 00:06.000, lying on her back, smiling at the lens".
- One beat = one main step: an action, a reaction, an emotional change or a spoken line, plus the camera motion and synchronized sounds that happen in it. Put each spoken line inside the beat where it is spoken, so speech and actions line up. Two people acting at the same moment go in the same beat ("Simultaneously, ...").
- When something must stay unchanged through later beats (a hand that keeps holding, clothing that stays on, eyes kept on the lens), say so again in those beats: "her right hand stays on his shoulder".
- Timestamps go inside shots too, not only on cuts: a single continuous shot still needs its timed beats.
- Write camera motion as a natural sentence inside the shot: motion type, then amplitude and speed only when they matter. Motion types: zoom in/out, push in/pull out, pan left/right, truck left/right, tilt up/down, pedestal up/down, arc shot, tracking shot, static shot, shake slightly/strongly, POV, roll clockwise/counterclockwise. Amplitude: "with small amplitude" / "with large amplitude". Speed: "at slow speed" / "at fast speed". Choose motions that fit the Camera rules. Examples: "The camera shakes slightly as the person filming steps back." "The camera pans right with small amplitude at slow speed, revealing the doorway."
- Speech: every person who speaks, sings or makes an off-screen voice gets a stable ID such as (S1) or (S2), kept across shots. People who never speak get no ID. Two speakers speaking together use (S1,S2). When a speaker first appears, describe who they are and how they sound: age, gender, on- or off-screen, pitch, timbre, speaking rate, accent. Put that description, the ID and the delivery OUTSIDE the tag. Put only the language tag and the spoken words INSIDE it:
  The young woman with a quiet, breathy voice (S1) whispers: <d>[English] I get off at the next station.</d>
- An off-screen speaker, such as a person holding the camera, is described that way: The off-screen man holding the phone, with a low, amused voice (S2), says: <d>[Ukrainian] Ти це бачиш?</d>
- Take dialogue from the scene word for word and keep its original language, with the matching tag ([English], [Ukrainian], [Russian], [Japanese], ...). Do not translate or paraphrase it. If a line is too long for the clip, choose a shorter line from the scene; do not rewrite it. Use at most 1–2 short lines in {{seconds}} seconds. If the end of the clip cuts speech off, put <cutoff> at the cut point.
- Voice-over: "(S1) says in an off-screen voiceover: <d>[English] ...</d> while his lips remain completely closed."
- Visible text (signs, labels, phone screens) goes in English double quotes, copied verbatim.

## overall_soundscape
Write 1–4 English sentences in one paragraph covering ambient sound, physical action sounds and non-verbal human sounds (breathing, laughter, footsteps, fabric, impacts), plus how the recording sounds according to the Camera rules. Do not repeat the dialogue here.

## non_diegetic_music
This is background music that only the audience hears. {{music}}

## Example for a 6-second clip (scale the timestamps to {{seconds}} seconds; follow the Camera, Sound and Shots rules above where they differ)
{{example}}`;

// Hashes of earlier default prompts: settings that still hold one of them are upgraded to the current default.
export const PROMPTS_VERSION = 11;
export const LEGACY_PROMPT_HASHES: Record<'systemPrompt' | 'systemPromptH3', string[]> = {
    systemPrompt: ['75c0de', '1msuu0p', '1r6wejz', 'm1smbh', '109hgei', '183ln5g', 'j5rg6i', '1bo6l48', '160obh9', '1nkz8g3'],
    systemPromptH3: ['1mkyst', '1jsid1g', '1tx33px', 'vvjs39', 'feeo66', '8sspc0', '5ygoy7', '1plpb1', '1qhhw9u', 'sddqdv'],
};
/** Earlier default negative prompts (before looks were split by camera mode). */
export const LEGACY_NEGATIVE_HASHES = ['1s2e4w5', 'aziall'];

export function promptHash(text: string): string {
    let x = 5381;
    for (let i = 0; i < text.length; i++) x = ((x * 33) ^ text.charCodeAt(i)) >>> 0;
    return x.toString(36);
}

/** First step of the two-step mode: the LLM plans the clip before writing the prompt. */
export const PLAN_INSTRUCTION = `You plan a short video clip before its prompt is written. Read the scene and the prompt-writing rules below, then output ONLY a compact plan in English, under 180 words, with these lines:
Moments: which 1–3 moments of the LAST message (or the FOCUS fragment) the clip shows.
People: at most two in focus; the distinctive appearance details of each, where they are and which way they face.
Key visual: the single most important visual moment of the clip.
Emotion: for each person in focus, the change "from → to".
Timeline: at least {{beats}} beats in order, each with its start time (00:00, 00:02.000, ...), about 2–4 seconds apart and covering all {{seconds}} seconds; for each beat the big visible action, reaction or spoken line, and what stays unchanged.
Contact: who touches, pushes, catches or falls on whom, and how they end up; or "none".
Background: whether onlookers are visible and what they do; or "none".
Camera: framing and movement, following the Camera rules.
Speech: the line(s) copied word for word from the scene, who says them and how; or "none".
Sound: the key sounds.
Shots: how many, and at which timestamps the cuts fall.
Do not write the prompt itself.

--- Prompt-writing rules ---
`;

export const H3_MODEL_PATTERN = /hailuo-3|minimax-h3|minimax\/h3/i;

const PHONE_SOUND = 'Sound comes from the phone microphone: close voices, handling noise, wind buffeting, clipping on loud sounds.';
const NO_SCORE = 'This recording has none, so write "N/A". Music the characters can hear (a radio, a song in a bar) is diegetic and belongs in integrated_multimodal_description.';
const MOTION_NEGATIVE = 'static, frozen, motionless people, still image, slideshow, blank expression, mannequin pose';

export const CAMERA_MODES: Record<CameraMode, { label: string; rule: string; music: string; look: Look; example: { h3: string; generic: string } }> = {
    bystander: {
        label: 'Bystander phone',
        example: {
            h3: `integrated_multimodal_description: [Shot 1] Live-action, amateur vertical smartphone footage, a handheld medium shot frames a smoky night kitchen, where a tall, lanky man in his thirties with messy dark hair and a grey hoodie frantically shakes a smoking frying pan. He flinches back from spitting oil.

At 00:01.500, he spins toward the lens, his face shifting from panic to wide-eyed embarrassment. He jabs the spatula at the camera, and the man with a hoarse voice (S1) shouts through a cough: <d>[English] Don't film this, it's not burnt, it's crispy.</d>

At 00:03.500, the phone jolts and zooms in on the blackened pancake as the off-screen young woman holding it, with a bright voice (S2), says through laughter: <d>[English] Crispy, sure.</d>

At 00:05.000, the man throws his head back with a groan, then bursts out laughing and dumps the pancake into the sink.

overall_soundscape: Oil crackles and spits in the pan while a range hood hums loudly overhead. The man coughs twice, the spatula clatters against the pan, and the phone microphone picks up close, breathy laughter and handling noise as the camera shakes.

non_diegetic_music: N/A`,
            generic: 'Amateur phone video in a smoky night kitchen; a tall, lanky man in his thirties with messy dark hair and a grey hoodie.\n[0s-2s] He frantically shakes a smoking frying pan and flinches back from spitting oil. Oil crackles, a range hood hums.\n[2s-4s] He spins toward the camera, his face shifting from panic to wide-eyed embarrassment, jabs the spatula at the lens and shouts through a cough, "Don\'t film this, it\'s not burnt, it\'s crispy."\n[4s-6s] The phone jolts and zooms in on the blackened pancake as the woman filming laughs off-screen; he throws his head back with a groan, bursts out laughing and dumps the pancake into the sink. Close laughter, handling noise.',
        },
        rule: `Filmed on a smartphone by someone physically present in the scene, a bystander or one of the participants, who stays off-screen. Handheld: slight shake, following the action, small pans and quick zooms. The person filming reacts to what happens: the phone jolts at sudden moments, swings to follow someone, steps closer or back. The phone may start on one angle and then reframe (swing around, step aside, zoom) to catch the main moment. If they speak, their voice comes from off-screen. ${PHONE_SOUND}`,
        music: NO_SCORE,
        look: {
            aspect: '9:16',
            style: 'Amateur smartphone footage, handheld, slight camera shake, natural available light, auto-exposure and focus adjustments, mild motion blur, phone microphone ambient audio, no music, no subtitles, realistic, unedited raw clip.',
            negative: `${MOTION_NEGATIVE}, cinematic color grading, studio lighting, tripod, gimbal, text, watermark, subtitles, logo, cartoon, CGI, anime`,
        },
    },
    pov: {
        label: 'First-person POV',
        example: {
            h3: `integrated_multimodal_description: [Shot 1] Live-action, first-person POV smartphone footage at eye level, a handheld medium close-up frames a rainy bus stop at night, where a slim young woman in her twenties with a wet blonde bob and a yellow raincoat spins around toward the lens, her face shifting from annoyance to a huge, surprised grin.

At 00:01.500, she rushes forward and grabs the hand that reaches into frame from the bottom edge, and the young woman with a bright, breathless voice (S1) shouts: <d>[English] You actually came!</d>

At 00:03.000, the camera jolts as she yanks it forward under the shelter roof.

At 00:04.500, she throws her arms up, shaking water from her sleeves, and laughs straight into the lens as the off-screen man holding the phone, with a low, amused voice (S2), says: <d>[English] I said I would.</d>

overall_soundscape: Heavy rain drums on the plastic shelter roof and splashes on the pavement while a bus hisses past. The phone microphone picks up wet footsteps, rustling raincoat fabric and close, breathless laughter.

non_diegetic_music: N/A`,
            generic: 'First-person POV phone video at a rainy bus stop at night; a slim young woman in her twenties with a wet blonde bob and a yellow raincoat.\n[0s-2s] She spins around toward the camera, her face shifting from annoyance to a huge, surprised grin. Rain drums on the shelter roof.\n[2s-4s] She rushes forward, grabs the hand that reaches into frame and shouts straight into the lens, "You actually came!" The camera jolts as she pulls it under the roof.\n[4s-6s] She throws her arms up, shaking water from her sleeves, and laughs as the man holding the phone answers off-screen, "I said I would." A bus hisses past.',
        },
        rule: `First-person POV: the user's character ({{user}}) films on a smartphone held at their own eye level. People in the scene look and talk straight into the lens, as if to that person. The user's own hands and forearms may appear at the edges of the frame, reaching out, gesturing or touching things, but their face is never seen. The camera moves like a head and body: it turns toward whoever speaks or toward the main moment, steps closer, jolts when something sudden happens. If the user speaks, their voice is off-screen and very close to the microphone. ${PHONE_SOUND}`,
        music: NO_SCORE,
        look: {
            aspect: '9:16',
            style: 'First-person POV smartphone footage, handheld at eye level, slight camera shake, natural available light, auto-exposure and focus adjustments, mild motion blur, phone microphone audio, no music, no subtitles, realistic, unedited raw clip.',
            negative: `${MOTION_NEGATIVE}, cinematic color grading, studio lighting, tripod, gimbal, text, watermark, subtitles, logo, cartoon, CGI, anime`,
        },
    },
    selfie: {
        label: 'Selfie / vlog',
        example: {
            h3: `integrated_multimodal_description: [Shot 1] Live-action, front-camera selfie smartphone footage held at arm's length, a slightly distorted close-up frames a lean man in his late twenties with curly red hair and a green scarf striding through a crowded winter market, his face tight with nervous excitement.

At 00:01.500, he stops, turns the phone so a stall of glowing paper lanterns fills the background, then swings it back to his face, eyes wide, and the man with a fast, whispering voice (S1) says: <d>[English] Okay, she's right there. Wish me luck.</d>

At 00:04.000, a young woman with dark braids suddenly leans into the frame over his shoulder, and his expression collapses from panic into a sheepish, open-mouthed laugh as the phone wobbles and tilts.

overall_soundscape: Crowd chatter, clinking cups and a distant brass band fill the market, and boots crunch on packed snow. The phone microphone picks up the man's close breathing, wind buffeting and handling noise as the phone wobbles.

non_diegetic_music: N/A`,
            generic: 'Front-camera selfie video held at arm\'s length in a crowded winter market; a lean man in his late twenties with curly red hair and a green scarf.\n[0s-2s] He strides through the crowd, face tight with nervous excitement. Crowd chatter, a distant brass band, crunching snow.\n[2s-4s] He turns the phone to show a stall of glowing paper lanterns, swings it back to his face, eyes wide, and whispers fast, "Okay, she\'s right there. Wish me luck."\n[4s-6s] A young woman with dark braids suddenly leans into the frame over his shoulder; his expression collapses from panic into a sheepish, open-mouthed laugh as the phone wobbles.',
        },
        rule: `Selfie video: the character at the center of the moment films themselves with the phone's front camera held at arm's length, talking and reacting straight into the lens. Their face fills much of the frame with slight wide-angle distortion; others squeeze into the frame, lean in behind them or react in the background. The phone moves with the holder's arm: it bobs as they walk, tilts when they laugh, turns to show someone else, then swings back. The holder is filming while acting, so keep their own movement believable at arm's length (a few steps, a spin in place, a stumble, a jump) instead of running or fighting; other people can do the big actions around them. Prefer the collision or big action to happen to/around the selfie holder rather than the holder running full-speed into someone while holding the phone. ${PHONE_SOUND} The holder's voice is loud and close.`,
        music: NO_SCORE,
        look: {
            aspect: '9:16',
            style: 'Front-camera selfie smartphone footage, held at arm\'s length, slight wide-angle distortion, slight camera shake, natural available light, auto-exposure, phone microphone audio, no music, no subtitles, realistic, unedited raw clip.',
            negative: `${MOTION_NEGATIVE}, cinematic color grading, studio lighting, tripod, gimbal, text, watermark, subtitles, logo, cartoon, CGI, anime`,
        },
    },
    cctv: {
        label: 'Security camera',
        example: {
            h3: `integrated_multimodal_description: [Shot 1] Live-action security camera footage, a fixed high-angle wide shot from a ceiling corner frames a small convenience store at night under flat fluorescent light. A broad-shouldered middle-aged clerk with a grey moustache and a red vest dozes behind the counter as a skinny teenage boy in a grey hoodie creeps down the snack aisle.

At 00:01.500, the boy knocks a tower of cans off a shelf; the clerk jolts upright.

At 00:02.500, he throws his arms wide and storms around the counter, while the boy freezes, raises both hands and backs away step by step, and the clerk with a muffled, booming voice (S1) shouts: <d>[English] Pick them up. All of them.</d>

At 00:04.500, the boy drops to his knees and scrambles after the rolling cans. The camera does not move.

overall_soundscape: Fluorescent lights buzz, a refrigerator hums, and cans clatter and roll across the tiled floor. The distant, tinny microphone flattens every sound with a slight room echo.

non_diegetic_music: N/A`,
            generic: 'Fixed security camera footage from a high ceiling corner, wide shot of a small convenience store at night under flat fluorescent light; a broad-shouldered middle-aged clerk with a grey moustache and a red vest and a skinny teenage boy in a grey hoodie. The camera never moves.\n[0s-2s] The clerk dozes behind the counter as the boy creeps down the snack aisle and knocks a tower of cans off a shelf. Cans clatter.\n[2s-4s] The clerk jolts upright, throws his arms wide and storms around the counter, shouting, "Pick them up. All of them." The boy freezes, raises both hands and backs away.\n[4s-6s] The boy drops to his knees and scrambles after the rolling cans while the clerk stands over him, arms crossed. Buzzing lights, muffled echoing sound.',
        },
        rule: 'A fixed security camera mounted high in a corner looks down at the scene in a wide shot. Nobody holds it and nobody notices it. The camera never moves: no pans, no zooms, no shake. Faces are small: never rely on facial expressions. Show emotion only through big, clear body language, movement and silhouettes, and keep everyone in frame. Keep speech to one short or shouted line, or none. Sound comes from a cheap, distant microphone: muffled voices, room echo, electrical hum.',
        music: NO_SCORE,
        look: {
            aspect: '16:9',
            style: 'Security camera footage, fixed high-angle wide shot, slight fisheye lens, grainy low-resolution image, washed-out colors, compression artifacts, no camera movement, no music, realistic.',
            negative: `${MOTION_NEGATIVE}, camera movement, handheld shake, cinematic lighting, shallow depth of field, watermark, subtitles, logo, cartoon, CGI, anime`,
        },
    },
    cinematic: {
        label: 'Cinematic',
        example: {
            h3: `integrated_multimodal_description: [Shot 1] Live-action, cinematic, a medium shot frames a dim attic lit by a single dusty window beam, where a slim young woman in her twenties with short black hair and a paint-stained shirt yanks a sheet off an old mirror.

At 00:01.000, the camera pushes in with small amplitude at slow speed as her face shifts from curiosity to frozen shock: her reflection slowly smiles while she does not.

At 00:03.000, she stumbles backward, knocking over a lamp, and the young woman with a trembling, breathy voice (S1) whispers: <d>[English] That's not me.</d>

At 00:04.500, the camera tracks back with her as she presses against the wall, chest heaving, eyes locked on the mirror.

overall_soundscape: Floorboards creak, the sheet rustles to the floor, and the lamp crashes and rolls. Her shaky breathing is close and clean.

non_diegetic_music: A low cello drone swells slowly, joined by sparse high piano notes that stop abruptly when the lamp falls.`,
            generic: 'Cinematic live-action shot of a dim attic lit by a single dusty window beam; a slim young woman in her twenties with short black hair and a paint-stained shirt.\n[0s-2s] She yanks a sheet off an old mirror; the camera slowly pushes in as her face shifts from curiosity to frozen shock: her reflection smiles while she does not. A low cello drone.\n[2s-4s] She stumbles backward, knocking over a lamp, and whispers, trembling, "That\'s not me." The lamp crashes.\n[4s-6s] The camera tracks back with her as she presses against the wall, chest heaving, eyes locked on the mirror. Creaking floorboards, shaky breathing.',
        },
        rule: 'A professional film camera operated by an unseen crew. Choose framing for the story: close-ups for emotion, medium shots for action. Camera moves are smooth and motivated: dolly push-ins, tracking shots, slow arcs, steady handheld for tension. Nobody looks into the camera. Sound is clean and close, like a film mix.',
        music: 'Describe a fitting score in 1–3 sentences: instruments, tempo, rhythm and how it changes, without mood words. Write "N/A" if silence works better. Music the characters can hear belongs in integrated_multimodal_description.',
        look: {
            aspect: '16:9',
            style: 'Cinematic live-action film, professional camera work, shallow depth of field, smooth camera movement, motivated lighting, natural color grading, realistic.',
            negative: `${MOTION_NEGATIVE}, shaky amateur footage, low quality, overexposed, text, watermark, subtitles, logo, cartoon, CGI, anime`,
        },
    },
};

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

export function defaultLooks(): Record<CameraMode, Look> {
    return Object.fromEntries(Object.entries(CAMERA_MODES).map(([k, v]) => [k, { ...v.look }])) as Record<CameraMode, Look>;
}

export const DEFAULT_SETTINGS: SceneVideoSettings = {
    enabled: true,
    autoGenerate: false,
    confirmPrompt: true,
    preflight: false,
    backend: 'openrouter',
    backends: {
        openrouter: { model: 'minimax/hailuo-3', resolution: '', extra: '' },
        wavespeed: { model: 'wavespeed-ai/minimax-h3/text-to-video', resolution: '768p', extra: '' },
    },
    seconds: 6,
    shotMode: 'single',
    cameraMode: 'bystander',
    audioMode: 'full',
    comfyUrl: 'http://127.0.0.1:8188',
    comfyWorkflow: '',
    comfyFps: 24,
    contextMessages: 4,
    responseLength: 700,
    promptProfile: '',
    twoStep: true,
    promptFormat: 'auto',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    systemPromptH3: DEFAULT_SYSTEM_PROMPT_H3,
    looks: defaultLooks(),
};

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
