// Camera modes: who records the clip, how it looks and an example prompt for each.

import type { CameraMode, Look } from '../types';

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
