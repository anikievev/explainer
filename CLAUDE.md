# CLAUDE.md

## Project overview

This project produces faceless YouTube videos that explain cloud and software architecture using animated 3D scenes built with Three.js.

The channel concept is: **“System design, animated.”** One building block per video: how it works and how it fails. Audience: developers learning system design, including for interviews. Positioning, evidence and out-of-scope topics live in `src/scenes/channel/CHANNEL.md`.

Each video turns a technical concept—such as Kubernetes, CDNs, load balancers, microservices, queues, databases, or failure handling—into a short, clear 3D animation. The final deliverable is a recorded video ready for voiceover, captions, music, and editing.

## Core principles

- Prioritize clarity over visual complexity.
- Every scene must support one specific sentence from the script.
- Use deterministic animation based on elapsed time, not random values, so rerenders are reproducible.
- Design for fixed video output: 1920×1080 or 3840×2160.
- Avoid interactive UI, mouse controls, and debug overlays in final renders.
- Keep scenes modular so assets, lighting, camera paths, and labels can be reused across videos.
- Prefer stylized “technical diagram” visuals over photorealism.
- Make the first 3 seconds visually engaging and clearly state the topic.First seconds decide everything. Hook them immediately 

## Tech stack

- **Runtime:** Node.js
- **Bundler:** Vite
- **Language:** TypeScript preferred; JavaScript acceptable for quick prototypes
- **3D engine:** Three.js
- **Models:** GLTF/GLB exported from Blender
- **Animation:** Custom timeline code, GSAP, or Tween.js
- **Recording:** OBS for quick captures; `canvas.captureStream()` + `MediaRecorder` for direct canvas recording
- **Editing:** DaVinci Resolve, CapCut, or Premiere Pro

## Project structure

```text
src/
  main.ts                 # Entry point
  scenes/
    kubernetes/
    cdn/
    load-balancer/
    microservices/
    queues/
  components/
    CameraRig.ts
    Label3D.ts
    NodeMesh.ts
    DataPacket.ts
    Timeline.ts
  assets/
    models/
    textures/
    fonts/
  scripts/
    record.ts
  config/
    video-settings.ts
output/
  renders/
  recordings/
```

## Video production rules

### Scene design

- One video = one concept.
- Break the script into visual beats.
- Each visual beat should have:
  - A camera movement
  - One main object or system change
  - Optional labels or highlights
- Do not add visual elements that do not reinforce the explanation.
- **Mascot reactions:** match the emotion to the beat, not just surprise and cheer. Poses in `Mascot.ts`: `poseWorried` (something is about to break, sweat drop), `poseScared` (crash, outage), `poseSad` (data lost), `poseThinking` (trade-off, "something has to notice"), `poseShrug` ("it depends", a cost), `poseDetermined` (the fix), `poseNod`, `posePoint` ("watch this"), `poseSurprised`, `poseCheer`. Aim for a reaction every 10–20 s in the presenter's `REACTIONS`.

### Camera

- Use pre-planned camera animations.
- Avoid user-controlled `OrbitControls` in the final render.
- Use slow, deliberate movements.
- Keep important objects centered.
- Use `camera.lookAt()` to guide attention.
- Avoid rapid zooms unless emphasizing a failure or key moment.

### Animation

- Drive animation from a central clock or timeline.
- Example pattern:

```ts
const elapsed = clock.getElapsedTime();
camera.position.x = Math.sin(elapsed * 0.3) * 6;
camera.position.z = Math.cos(elapsed * 0.3) * 6;
camera.lookAt(0, 0, 0);
```

- Use easing for camera and object movement.
- Keep transitions between scenes short and intentional.
- Use color consistently:
  - Green: healthy / success
  - Yellow: warning / degraded state
  - Red: failure / error
  - Blue: data flow / network traffic
  - Purple: storage / database

### Text and labels

- Keep on-screen text minimal.
- Use short labels, not paragraphs.
- Ensure labels remain readable at 1080p and 4K.
- Do not rely only on color to convey meaning; add icons, labels, or motion.
- Use high contrast against the background.

## Recording standards

- Render resolution: work and review at 1920×1080; render the upload at **2560×1440** (`npm run record:1440p`, then `npm run voiceover`, which muxes onto the 1440p file when it exists). YouTube encodes 1440p+ uploads with a better codec and bitrate, so they look sharper even when watched at 1080p. 3840×2160 (`--4k`) is optional; it takes much longer to render.
- Frame rate: 30 fps default; 60 fps only when motion clarity benefits from it.
- Background: dark, clean, low-noise gradient or solid color.
- Do not include browser UI, dev tools, cursors, or console output.
- Export directly from canvas where possible:

```ts
const stream = renderer.domElement.captureStream(30);
const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp9'
});
```

- Save raw recordings in `output/recordings/`.
- Save final edited videos outside the repository or in a separate media storage location.

## Thumbnails

Every episode thumbnail is a static scene (`src/scenes/<episode>/Thumbnail.ts`) built with the shared kit in `src/components/ThumbnailKit.ts`, so the series reads as one.

- **Hook:** 2–4 words, top-left, at most two lines, one accent colour per line. Long explanatory text reads like a slide and loses clicks. `pickVariant()` fails the render above 4 words.

 Here are a few hook angles that consistently worked:

Curiosity gaps - hint at something without explaining it:

“This Changed Everything” or “Didn’t Expect This”

Negative / risk - triggers fear of mistakes or loss:

“Big Mistake” or “I Regret This”

Positive payoff - promise a clear upside:

“Worth Every Penny” or “Best Decision”

Surprise / disbelief - break expectations:

“This Worked?” or “I Was Shocked”

Authority / certainty - strong, confident statements:

“Do This Instead” or “Stop Doing This”

Contrast - before vs after, good vs bad:

“Then vs Now” or “Cheap vs Expensive” 
- **No title pill:** don't repeat "How X Works" on the thumbnail; the video title already says it.
- **Layout:** text on the left, subject on the right (viewers scan left to right). One clear subject, not a whole diagram.
- **Extra text:** at most one or two big number badges (`numberBadge`, ≥ 60 px), readable on a phone. No small labels.
- **Background:** a coloured `glow()` behind the subject plus `vignette()` instead of flat navy. Red for the problem side, green for the fix, purple for storage or queues.
- **Mascot:** large (about 40% of the height), next to the subject, with an expression that matches the hook: `poseSurprised` for risk or surprise, `poseCheer` for payoff, `posePoint` for contrast.
- **Bottom-right corner stays empty:** YouTube draws the duration badge there. `assertClearOfBadge()` fails the render if a badge lands in it.
- **Three A/B variants per episode** (`a`, `b`, `c`): the same scene with a different hook type (risk, curiosity, payoff, surprise, contrast) for YouTube Test & compare. Every hook must match a verified claim in the episode script.
- **Render and review:** `node src/scripts/record.ts --episode <id> --thumbnail` writes `<slug>-thumbnail-{a,b,c}.jpg/png` (variant `a` is also `<slug>-thumbnail.jpg`) and `<slug>-thumbnails-preview.png`. Check the preview sheet at 320×180 (phone size) before uploading.
- **Shorts get a cover, not a designed thumbnail:** most Shorts views come from the feed, where no thumbnail shows. Set `cover` (video time, anchored to a cue) on each Short at a strong moment. `npm run shorts` writes a clean `-cover.png` (hook + step pill, no captions) and puts the frame time in `SHORTS.md` for Studio's frame picker. Upload the PNG once custom Shorts thumbnails are available to the channel.

## Content guidelines

### Video formats

Use these repeatable formats:

1. **Concept explainer**  
   Example: “How a CDN actually works.”

2. **Failure walkthrough**  
   Example: “What happens when a Kubernetes pod crashes.”

3. **Comparison**  
   Example: “Load balancer vs. message queue.”

4. **Request journey**  
   Example: “What happens when you open a website.”

5. **Architecture teardown**  
   Example: “How a Netflix-style streaming system is designed.”

### Topic selection

- Stay inside the niche: system design building blocks (concepts, not tools). Defer Kubernetes, AWS how-tos and broad DevOps.
- **Demand check before scripting:** search YouTube for the topic, find videos on channels under 200k subscribers that got ≥3× their channel's median views in the last 12 months, and note the angle and title that worked. Read the top comments on those videos; repeated questions become script beats. Record findings in the episode's `PLAN.md`. Never invent numbers.
- Roadmap (each item still demand-checked): caching (next), database indexes / replication, sharding, rate limiting, idempotency / exactly-once, API gateway vs reverse proxy vs load balancer, consistent hashing, CAP theorem.

### Titles

- Plain "X explained" searches are owned by big, older channels. Win on angle: prepare a "How X Works" title plus a myth or failure title (e.g. "Why Your Order Got Charged Twice", "Load Balancers Don't Work Like You Think") and test them.
- Bare topic words are noisy in search ("kafka", "cdn"). Put "system design" in the tags and in the description's closing line.

### Shorts

- **The first second decides the Short.** In the first uploads (Oct 28 – Nov 2, 2026), 86–91% of Shorts-feed viewers swiped away, and each Short then got about one day of views. Viewers who stayed watched about a third, so the opening is the problem, not the length.
- **Open on the problem or the payoff, never on setup.** A Short's first spoken line must be the strongest moment ("So shoppers see the wrong price", "Every request misses"), not context ("A server checks the cache first", "First: the thundering herd"). Use `open` in `shorts.ts` for a cold open (a cue or two of the payoff, then the explanation), or start the Short right on the surprise line.
- **Drop list framing from the full video** ("First:", "Trap 2:", "Let's recap") from a Short's opening.
- **Every Short stands alone.** Feed viewers never saw the full video, so no line may point at it: no "those servers", "That's 80 percent", "Compare that", and no ending on a "Second: …" teaser. `npm run shorts -- --episode <id> --check` flags these (it also runs before every cut), plus a cold open whose line comes back less than 10 s into the main clip (it sounds like a glitch; start on the problem line instead). Fix by moving the cut first; when the main clip needs setup the Short leaves out, add an `intro` line (`{ say, at }` in `shorts.ts`): it is synthesized in the episode voice and played after the cold open, over footage from `at` (e.g. split-brain: "Your primary database crashes, and a replica is promoted…").
- **Comparisons hold best:** "X vs Y" Shorts had the highest stay rate (L4 vs L7, queue vs Kafka). Make at least one comparison Short per episode when the script supports it.
- **Prefer 30–45 s.** Keep every Short under 60 s; `npm run shorts` fails above that.
- **Hashtags:** `#systemdesign` first, then the topic. Never `#cloudarchitecture`, and only tags that match the Short.
- **Link back:** set each Short's "Related video" to its episode and pin a comment with the link; Shorts sent almost no viewers to the long videos.
- **Sound accents (test, Nov 2026):** Shorts can mix quiet effects from `src/assets/sfx/` (`npm run sfx` generates them; set `beatSounds` and `sfx` in `shorts.ts`). Sharding Short #1 is the first with sound; compare its "Stayed to watch" with the silent ones before adding sound everywhere.
- **Instagram Reels:** `npm run shorts -- --episode <id> --instagram` cuts the same clips into `output/renders/shorts/<id>/instagram/` with text moved clear of Instagram's top bar and right-side buttons, plus `REELS.md` captions (a save line, the Short's own `question` for comments, "Full video: link in bio", 3–5 hashtags). `--notes-only` rewrites the captions without re-cutting. Upload these files, never YouTube downloads (watermarked reposts get less reach).
- **LinkedIn:** only failure / trade-off clips go to LinkedIn, never "what is X" (that reads as junior there). Mark them by giving the Short a `linkedin` post body in `shorts.ts`: lead with the failure, explain in short paragraphs, end with a question, every claim from the episode script, no invented personal stories. `npm run shorts -- --episode <id> --linkedin` cuts only those clips in 4:5 (1080×1350) into `output/renders/shorts/<id>/linkedin/`, plus `LINKEDIN.md` (post, hashtags, first comment with the YouTube link). Every post starts with "System design, animated #N:"; N is the posting order in `src/config/linkedin.ts` (`LINKEDIN_ORDER`; append new posts, never reorder posted ones).
- **After upload, check "Stayed to watch"** (viewed vs. swiped away) for each Short, and note it in the episode's `PLAN.md` results.

### After upload

- Log results in the episode's `PLAN.md` under "Results" after 7 days: CTR, average view duration, where retention drops, and the one thing to improve in the next episode.

### Video structure

- **0–3 seconds:** Hook and visual establishment.
- **No recap of the previous episode in the hook.** Open on this episode's problem from the first line ("Black Friday. Every order is a write."), not on "Last episode, …". A callback to an earlier episode can come later, in one short line, or as a card. (User request, Nov 2026.)
- **End the hook with a promise (by about 0:25):** one line saying what the viewer will get, with the episode's most surprising payoff in it ("In six minutes: how to pick a shard key, why one shard can melt down, and why adding a database can move 80 percent of your data"). YouTube Studio's review (Nov 2026) flagged that our hooks showed the problem but never said what the viewer gains; caching lost most viewers in the first 30 s.
- **3–15 seconds:** Introduce the system or problem.
- **15–70% of runtime:** Explain step by step with animation.
- **Final 15%:** Summarize the key takeaway.
- **End:** Ask a relevant question or suggest the next related video.

### Script rules

- Write the script before building the scene.
- Use plain language before introducing jargon.
- Define acronyms on first use.
- Keep sentences short.
- Use concrete examples: “a user in Berlin,” “a request to the API,” “a failed pod.”
- Avoid unsupported performance or cost claims.

## Coding conventions

- Use TypeScript.
- Use descriptive names: `apiGateway`, `workerNode`, `databaseReplica`, not `object1`.
- Keep scene setup, animation logic, and recording logic separated.
- Prefer small reusable components over large monolithic scene files.
- Use constants for colors, dimensions, camera positions, and timing.
- Avoid hardcoding resolution values in multiple files.
- Clean up GPU resources when destroying scenes:

```ts
geometry.dispose();
material.dispose();
texture.dispose();
```

- Do not commit generated video files, large model binaries, or node_modules.

## Dependencies

- Keep dependencies minimal.
- Prefer official Three.js addons where available.
- Do not add UI libraries unless necessary.
- Pin major dependency versions.
- Document any new dependency and why it is needed.

## Git workflow

- Branch naming:
  - `feature/<topic>-scene`
  - `fix/<issue-description>`
  - `video/<video-slug>`

- Commit message style:

```text
feat: add CDN edge-server scene
fix: stabilize Kubernetes pod animation timing
chore: update recording settings for 4K output
```

- Do not commit:
  - `node_modules/`
  - `output/recordings/`
  - large `.glb` files unless necessary
  - API keys or credentials

## Definition of done

A video scene is complete when:

- It renders at the target resolution without visual glitches.
- Animation is deterministic and reproducible.
- Camera movement is smooth and intentional.
- Labels are readable.
- The visual sequence matches the script.
- The recording exports successfully.
- No debug tools or interactive controls appear in the final output.
- Assets and reusable components are organized correctly.

## Assistant instructions

When helping with this project:

- Ask for the video topic and target length if not provided.
- Start from the script and visual beats before writing scene code.
- Prefer simple, reusable Three.js implementations.
- Optimize for educational clarity, not technical showmanship.
- Point out unclear explanations, excessive visual complexity, or missing labels.
- When generating code, include only the necessary scene, animation, and recording logic.
- Never invent cloud architecture facts; verify technical claims before including them in scripts.
