# Scene Video for SillyTavern

🇬🇧 **English** · 🇺🇦 [Українська](README.uk.md)

A SillyTavern extension that turns a scene written by the LLM into a short, amateur-looking video clip: vertical, handheld, as if someone in the scene filmed it on a phone.

How it works:

1. Click 🎥 in a message's menu, or run `/scenevideo`. To film one moment, select that text in the message first.
2. Your current SillyTavern LLM rewrites the message as a prompt for a video model. It uses the character description, your persona and a few earlier messages for context. Names are replaced with descriptions of appearance, because video models don't know who the characters are.
3. You can review and edit the prompt, or click **Regenerate** for a new one. The "smartphone footage" style is added for you.
4. The clip is generated with **OpenRouter**, **WaveSpeed** or **ComfyUI**. It is saved to `data/<user>/user/images/<character>/` and attached to the message.

The default model is **MiniMax H3**:

| Backend | Model id | Duration | Notes |
|---|---|---|---|
| OpenRouter | `minimax/hailuo-3` | 5–15 s | with audio, ~$0.13/s |
| OpenRouter | `minimax/hailuo-3-max` | 5–15 s | 480p/768p, no audio, $0.05–0.08/s |
| WaveSpeed | `wavespeed-ai/minimax-h3/text-to-video` | 3–15 s | 480p/540p/768p/1080p, with audio |

Any other OpenRouter or WaveSpeed video model works too. In the settings, **Show OpenRouter video models** lists the current models and their prices.

## Installation

The extension has two parts:

- **UI extension**: the button, the settings and the LLM prompt step. Required.
- **Server plugin**: a small proxy to OpenRouter and WaveSpeed. Required for those two backends, not needed for ComfyUI.

### 1. UI extension

In SillyTavern, open **Extensions → Install extension** and paste the repository URL:

```
https://github.com/Saref111/SillyTavern-Scene-Video
```

### 2. Server plugin

SillyTavern cannot install server plugins from the Extensions menu, so clone the same repository into the `plugins` folder:

```bash
cd SillyTavern/plugins
git clone https://github.com/Saref111/SillyTavern-Scene-Video scene-video
```

Then set `enableServerPlugins: true` in `SillyTavern/config.yaml` and restart SillyTavern. The server log should show `[scene-video] plugin loaded`.

SillyTavern finds the plugin through `"main": "server/index.mjs"` in `package.json`. With `enableServerPluginsAutoUpdate: true`, it runs `git pull` on the plugin at startup.

### 3. API keys

- **OpenRouter** uses the key you already saved in SillyTavern's API Connections (`api_key_openrouter`).
- **WaveSpeed**: paste the key in the extension settings and click **Save**. It is stored in SillyTavern's secret store as `api_key_wavespeed`.

The settings panel shows whether the plugin is loaded and the key is set.

**Why a server plugin?** API keys should never reach the browser. The plugin reads them from SillyTavern's secret store and makes the requests itself. It also polls the job until the video is ready, which can take several minutes. ComfyUI goes through SillyTavern's built-in endpoints (`/api/sd/comfy/*`), so it doesn't need the plugin.

## MiniMax H3 prompt format

H3 works best with the structured prompt described in the [official prompt-writing guide](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/docs/VIDEO_PROMPT_WRITING_GUIDE_base_en.md) (T2VA mode):

```
integrated_multimodal_description: [Shot 1] Live-action, amateur vertical smartphone footage, ...
  ... the young woman with a quiet, breathy voice (S1) says: <d>[English] Are you seeing this?</d>

overall_soundscape: ...

non_diegetic_music: N/A
```

With **Prompt format → Auto**, the extension switches to this format whenever an H3 model is selected (`minimax/hailuo-3*`, `…/minimax-h3/…`). Other models get a plain one-paragraph prompt.

How the H3 format is handled:

- The LLM instruction is a condensed version of the guide, adapted to phone footage: a handheld camera (`shakes slightly`, `POV`, `tracking`), one or several shots depending on **Shots**, and speaker IDs `(S1)`, `(S2)`.
- Who films and how the camera moves depend on **Camera**.
- Dialogue is copied from the scene word for word, in its original language, with a tag such as `[English]` or `[Ukrainian]`.
- The style goes at the start of `[Shot 1]` (the `{{style}}` placeholder). It is not appended at the end, which would break the structure.
- `non_diegetic_music` is `N/A`, because amateur footage has no background score. Only the **Cinematic** camera may describe a score.
- The LLM output is cleaned up: preambles, code fences and `**bold**` field names are removed, and a missing `non_diegetic_music` field is added.
- No negative prompt is sent, because H3 doesn't support one.

## Prompt settings

**Camera** sets who or what records the clip. Each camera has its own **Aspect**, **Style** and **Negative prompt**; these fields edit the ones of the selected camera. Phone cameras default to 9:16, the security camera and cinematic to 16:9.

| Camera | What you get |
|---|---|
| Bystander phone (default) | someone in the scene films on a phone and reacts to what happens |
| First-person POV | your character films; people look and talk into the lens, your hands may appear, your face never does |
| Selfie / vlog | a character films themselves with the front camera at arm's length; face close, others squeeze into the frame |
| Security camera | a fixed camera high in a corner, wide shot, no camera movement; emotion through body language |
| Cinematic | a film camera with smooth moves and close-ups; H3 may add a background score |

**Sound** sets what the clip sounds like: dialogue and ambient sound (default), dialogue only, ambient sound without speech, or no sound. With **No sound**, OpenRouter generates the video without audio; for WaveSpeed only the prompt changes.

**Shots** sets how the clip is cut:

| Option | What the LLM writes |
|---|---|
| One continuous shot (default) | a single shot with no cuts; the phone moves to change distance or angle |
| Several shots | 2–4 short shots, like phone recordings joined together; each one is a different moment, place or angle |
| Let the LLM decide | one shot when the moments flow into each other in one place, several when they are apart in time or place |

The number of shots depends on the duration: up to 3 for 6 s, up to 4 for 8 s or more. Each shot lasts at least about 2 seconds. H3 prompts use `[Shot 2] At 00:03.500, ...`; other models get `Cut to:`.

**Regenerate** in the prompt review popup asks the LLM for a new prompt without closing the popup. It uses the current settings, so you can change **Shots** and regenerate right away.

The LLM picks the 1–3 moments of the message that matter most. The instruction keeps the prompt short and lively: about 20 words per second of video, at most two people in focus with their faces toward the camera, one clear change of emotion per person, and big whole-body actions instead of small details. Long, detailed prompts make video models produce calm, almost still clips.

Placeholders in the instructions:

| Placeholder | Value |
|---|---|
| `{{seconds}}` | clip duration |
| `{{words}}` | word budget for the description (20 per second, 80–260) |
| `{{shots}}` | the rule for the selected **Shots** option |
| `{{camera}}` | the rule for the selected **Camera** |
| `{{audio}}` | the rule for the selected **Sound** |
| `{{music}}` | the background music rule for the selected camera (H3 only) |
| `{{user}}` | your persona's name |
| `{{aspect}}`, `{{style}}` | aspect ratio and the selected camera's style (H3 only) |

If a custom instruction has no `{{shots}}`, `{{camera}}`, `{{audio}}` or `{{music}}`, that rule is appended at the end. Default instructions are upgraded automatically after an update; edited ones are kept, so add new placeholders yourself or click **Restore default prompts**.

## Slash command

```
/scenevideo                 — video for the last message
/scenevideo 12              — video for message #12
/scenevideo prompt="..."    — use your own prompt and skip the LLM step
/scenevideo quiet=true      — skip the prompt review popup
/scenevideo focus="..."     — build the clip around this fragment of the message
```

The command returns the URL of the saved video, so you can use it in STscript and Quick Replies.

## Extra params

Each WaveSpeed model has its own parameter schema. Fields in **Extra params (JSON)** are merged into the request, and `null` removes a default field. Example: `{"seed": 42, "aspect_ratio": null}`.

## ComfyUI

Copy `workflows/SceneVideo_Wan22_5B.json` into `data/<user>/user/workflows/`, then select it in the settings. It is an example for Wan 2.2 TI2V 5B and hasn't been tested yet.

A workflow must be in API format. These placeholders are replaced, including their quotes:

| Placeholder | Value |
|---|---|
| `"%prompt%"` | prompt + style suffix |
| `"%negative_prompt%"` | negative prompt |
| `"%seed%"` | random integer |
| `"%width%"` / `"%height%"` | 704×1280 for 9:16, 1280×704 for 16:9 |
| `"%length%"` | frame count (`seconds × fps`, rounded to 4n+1) |
| `"%fps%"` / `"%seconds%"` | from the settings |

The output node must be `SaveVideo` (core) or `VHS_VideoCombine`.

## Development

```
src/          UI extension (TypeScript + webpack, based on SillyTavern/Extension-WebpackTemplate)
server/       SillyTavern server plugin: proxy for OpenRouter and WaveSpeed
workflows/    example ComfyUI workflow (Wan 2.2 TI2V 5B)
```

```bash
npm install
npm run build                          # → dist/index.js
./install.sh /path/to/SillyTavern default-user
```

`install.sh` creates two symlinks:

- `data/<user>/extensions/SillyTavern-Scene-Video` → this repository (UI);
- `plugins/scene-video` → `server/` (plugin).

SillyTavern does not build extensions, so `dist/` must be committed. Run `npm run build` before every push.

## License

[AGPL-3.0](LICENSE)
