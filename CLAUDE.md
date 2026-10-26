# CLAUDE.md

## Project overview

This project produces faceless YouTube videos that explain cloud and software architecture using animated 3D scenes built with Three.js.

The channel concept is: **“Cloud architecture explained visually.”**

Each video turns a technical concept—such as Kubernetes, CDNs, load balancers, microservices, queues, databases, or failure handling—into a short, clear 3D animation. The final deliverable is a recorded video ready for voiceover, captions, music, and editing.

## Core principles

- Prioritize clarity over visual complexity.
- Every scene must support one specific sentence from the script.
- Use deterministic animation based on elapsed time, not random values, so rerenders are reproducible.
- Design for fixed video output: 1920×1080 or 3840×2160.
- Avoid interactive UI, mouse controls, and debug overlays in final renders.
- Keep scenes modular so assets, lighting, camera paths, and labels can be reused across videos.
- Prefer stylized “technical diagram” visuals over photorealism.
- Make the first 3 seconds visually engaging and clearly state the topic.

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

- Render resolution: 1920×1080 minimum; 3840×2160 preferred for final uploads.
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

### Video structure

- **0–3 seconds:** Hook and visual establishment.
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
