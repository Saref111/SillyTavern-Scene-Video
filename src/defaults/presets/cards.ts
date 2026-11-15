// Appearance cards: instructions for drawing a card, choosing cards for a clip and referring to them in the prompt.

/** At most this many cards go into one video request. */
export const MAX_CARDS = 3;

/** At most this many extra people (not SillyTavern characters) per character or group. */
export const MAX_EXTRA_PEOPLE = 3;

/** The LLM writes the appearance of one person; the sheet layout around it is fixed (see helpers/sheet). */
export const CARD_PROMPT_INSTRUCTION = `You describe how one person looks, for a character reference sheet that a video model will use to keep this person's face and body identical across clips.

Output ONLY the description, in English, one paragraph, 60–120 words, no preamble. Never use the person's name; start with "A real adult woman" or "A real adult man" and the age (always 18 or older).

Include:
- Age range, gender, ethnicity or skin tone, face shape, eye color, hair color, length and style, and every lasting feature from the description (tattoos, piercings, freckles, scars, glasses, jewelry worn every day).
- Build is required and must state the actual weight: use concrete words such as "slim", "slender", "petite", "toned", "athletic", "slim waist". Translate vague words ("curvy", "thick", "voluptuous", "full-figured") into "slim with an hourglass figure, narrow waist". Write a heavy build only when the description states plainly that the person is overweight.
- Breast size is required for a woman and must keep the size from the description: image models draw breasts smaller than written, so state it with a bra cup size and a visible-volume word: small → "small A-cup breasts", medium → "medium C-cup breasts", large → "large, heavy DD-cup breasts", very large or huge → "very large, heavy F-cup breasts". A slim frame never makes them smaller. Keep hips and buttocks as described ("wide rounded hips", "round buttocks").
{{outfit}}
- No art style: the person is a real human in a photograph, even when the description comes from an anime or a game.`;

/**
 * The character sheet layout, after the MiniMax H3 character sheet workflow (r/comfyui):
 * a portrait on the left, three full-body angles in the center, six round detail images on the right.
 */
export const SHEET_LAYOUT = `<CHARACTER> on white background, photographic reference sheet with exactly five parts from left to right, each separated and not overlapping:
1. On the left: <CHARACTER> portrait photo (head and chest) closeup on white background.
2, 3, 4. In the center: exactly three full body photos of <CHARACTER>, standing still in the same neutral pose with arms at the sides, from 3 different angles: straight from front, straight from side, straight from back. No other figures and no other poses.
5. On the right edge only: one narrow block of 6 round photos of the same size, 2 columns and 3 rows, each an extreme close-up of a single detail of <CHARACTER>, never a whole face: one eye only, lips only, one ear only, hair strands, skin texture, one hand.
Every element appears only once: the portrait, the three figures and the block of circles are never repeated.`;

/** MiniMax H3 prompt for a sheet drawn from a description only. */
export const SHEET_FROM_TEXT_H3 = `integrated_multimodal_description:

subject_definitions:
<CHARACTER>: {{description}}

summary:
static real photograph: a model casting reference sheet of <CHARACTER>, a real person, shot in a photo studio, full color.

detailed_description:
The target is a static real photograph (not CGI, not a 3D render, not a game character, not an illustration) of a reference sheet showing <CHARACTER> from different angles, each element is separated and not overlapping. Natural skin with pores and small imperfections, true-to-life colors, soft even studio light, 85mm lens, sharp focus.

[Shot 1] static image.

{{layout}}

overall_soundscape: N/A

non_diegetic_music: N/A`;

/** MiniMax H3 prompt for a sheet drawn from a reference picture of the person (<Picture 1>). */
export const SHEET_FROM_PICTURE_H3 = `integrated_multimodal_description:

subject_definitions:
<CHARACTER> character from <Picture 1>. Notes: {{description}}

summary:
[reference generation] static real photograph: a model casting reference sheet of <CHARACTER>, keep exactly the same face, hair, skin and body of <Picture 1>, full color.

retention_analysis:
<CHARACTER>: face and identity fully_preserved; clothing and pose follow the notes and the sheet.

detailed_description:
The target is a static real photograph (not CGI, not a 3D render, not a game character, not an illustration) of a reference sheet showing <CHARACTER> from different angles, each element is separated and not overlapping. Natural skin with pores and small imperfections, true-to-life colors, soft even studio light, 85mm lens, sharp focus.

[Shot 1] static image.

{{layout}}

overall_soundscape: N/A

non_diegetic_music: N/A`;

/** Sheet prompt with a reference picture for other image models (OpenRouter, WaveSpeed edit models). */
export const SHEET_FROM_PICTURE_PLAIN = `Real photograph, model casting reference sheet of the person in the attached picture: exactly one portrait, exactly three full-body figures and exactly six circles. Keep exactly the same face, hair, skin tone and body as in the picture. Not CGI, not a 3D render, not a game character, not an illustration: a real person shot in a photo studio, natural skin with pores and small imperfections, true-to-life colors, soft even studio light, 85mm lens, sharp focus. Notes about the person: {{description}}

{{layout}}

The same person, the same body and the same look everywhere. No text, labels or watermarks.`;

/** Sheet prompt for other image models (SillyTavern's sources, Krea, Seedream…). */
export const SHEET_FROM_TEXT_PLAIN = `Real photograph, model casting reference sheet: exactly one portrait, exactly three full-body figures and exactly six circles. Not CGI, not a 3D render, not a game character, not an illustration: a real person shot in a photo studio, natural skin with pores and small imperfections, true-to-life colors, soft even studio light, 85mm lens, sharp focus. The person: {{description}}

{{layout}}

The same person, the same body and the same look everywhere. No text, labels or watermarks.`;

/** Bump when CARD_PROMPT_INSTRUCTION changes, so saved card prompts are written again. */
export const CARD_PROMPT_VERSION = 8;

/** The clothing rule of the card description, by the outfit chosen in the cards popup. */
export const CARD_OUTFIT_RULES = {
    underwear: '- Clothing: underwear only, so the sheet shows the real figure; the clips dress the person. Use the underwear this person would wear if the description suggests it (style and color), otherwise plain matching cotton underwear: a simple bra and briefs for a woman, boxer briefs for a man. Always opaque and fully covering, barefoot. Name its color. No other garments. Never write that the person is naked, nude or topless: the sheet always shows underwear. End the description with the sentence about the underwear.',
    nude: '- Clothing: none. The person is fully nude and barefoot, standing in a neutral, non-sexual reference pose, so the sheet shows only the body and the clips dress the person. No clothes, underwear, shoes or accessories except jewelry worn every day. End the description with "fully nude, barefoot".',
};

/** Sentences about nudity are dropped from a card description, which must always show underwear. */
export const CARD_NUDITY = /\b(naked|nude|nudity|topless|bottomless|unclothed|undressed|bare[- ]?(chested|breasted|skinned)|without (any )?(clothes|clothing|underwear)|no (clothes|clothing|underwear))\b/i;

/** The description must mention underwear; otherwise this is added. */
export const CARD_UNDERWEAR = /\b(underwear|bra|bras|bralette|briefs|panties|knickers|thong|boxers|boxer briefs|lingerie|bikini|undershirt|trunks)\b/i;

export const CARD_DEFAULT_UNDERWEAR = {
    woman: 'She wears plain white cotton underwear: a simple opaque bra and briefs, and is barefoot.',
    man: 'He wears plain dark grey cotton boxer briefs and is barefoot.',
};

/** Card picture shapes offered in the cards popup. */
export const CARD_ASPECTS = ['3:2', '16:9', '2:1', '21:9', '3:1'];

/** Resolution tiers and their megapixels (as WaveSpeed counts them). */
export const CARD_RESOLUTIONS: Record<string, number> = { '1k': 1, '1.5k': 2.4, '2k': 4 };

/** Width and height in pixels (multiples of 64) for a shape and tier, for SillyTavern's Image Generation. */
export function cardPixels(aspect: string, resolution: string): { width: number; height: number } {
    const [w, h] = aspect.split(':').map(Number);
    const ratio = w > 0 && h > 0 ? w / h : 16 / 9;
    const pixels = (CARD_RESOLUTIONS[resolution] ?? 1) * 1024 * 1024;
    const height = Math.round(Math.sqrt(pixels / ratio) / 64) * 64;
    return { width: Math.round(height * ratio / 64) * 64, height };
}

/** The LLM decides which of the available cards show people who are on screen in this clip. */
export const CARD_PICK_INSTRUCTION = `You decide who will be visible on screen in a short video clip of a roleplay scene.

Below are the scene and a numbered list of people who have reference pictures. Answer with the numbers of the people who appear on screen in the clip of the LAST message (or of the FOCUS fragment), at most {{max}}, most important first, comma-separated, for example "2, 1". Answer "none" if none of them is visible. Output nothing else.`;

/** Appended to the instruction when cards are sent with the clip. */
export const CARD_RULES = {
    h3: `## Reference pictures
The video model receives reference pictures of some people (listed in the scene as <Picture N>). For each of them:
- Refer to the person by the picture tag on first appearance, for example "the woman from <Picture 1>", then simply "she". Keep the tag in the shot where the person first appears.
- The picture defines ONLY the face, hair and body. Do not describe them.
- The picture does NOT define clothing or state: it shows the person in underwear or nude only to show the body, and the video model copies whatever it sees unless the prompt says otherwise. For every person with a picture, write in the shot where they first appear what they wear right now in the scene, garment by garment with colors (and what is open, pulled up, wet or missing), and their current state: wet or messy hair, makeup, sweat, blush, dirt, injuries, tiredness. Take all of it from the scene; when the scene doesn't say, choose clothing that fits the place and the moment, never the underwear or nudity of the picture.
- When clothing changes during the clip (taken off, put on), say so in the shot where it happens.
- Each picture is a character sheet of ONE person seen from several angles; show that person once, never as copies, and never merge two pictures into one person.
- People without a picture are described in words as usual.`,
    generic: 'Reference pictures: the video model receives reference images of some people (listed in the scene as "reference image N"). Each image is a character sheet of ONE person seen from several angles; show that person once. Refer to each such person as "the woman from reference image 1" (or man) and do not describe their face, hair or build. The images define only the face and body: they show the person in underwear or nude, and the video model copies that unless told otherwise. So for every such person always describe what they wear right now in the scene, garment by garment with colors, and their current state (wet or messy hair, makeup, sweat, injuries); when the scene doesn\'t say, choose clothing that fits the place and moment, never the underwear or nudity of the image. People without a picture are described in words as usual.',
};
