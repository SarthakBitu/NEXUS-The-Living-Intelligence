# NEXUS — The Living Intelligence

An interactive 3D digital consciousness built with React, TypeScript, Three.js, custom GLSL GPU shaders, procedural Web Audio synthesis, Web Speech API voice interaction, optional MediaPipe hand tracking, and a secure Express + Gemini AI backend.

## Architecture & Project Structure

- `server.ts` — Express server with Vite middleware in development, static `dist/` serving in production, and `POST /api/chat` backed by `@google/genai` (`gemini-4-hydrogen`).
- `src/engine/brainGeometry.ts` — Procedural 3D coordinate buffers for 24,000 GPU particles across five formations (`orb`, `galaxy`, `brain`, `neural`, `consciousness`) plus 340 curved axonal pathway splines.
- `src/engine/shaders.ts` — Custom GLSL vertex & fragment shaders for GPU morphing, 3D simplex noise breathing, traveling neural electricity impulses, volumetric Fresnel core plasma, expanding shockwave rings, and cinematic post-processing.
- `src/engine/NexusEngine.ts` — Three.js WebGL lifecycle manager with `EffectComposer` (`UnrealBloomPass` + cinematic pass), software-WebGL guard (`afterDraw`), `OrbitControls`, mouse/touch raycasting, and hand-gesture camera hooks.
- `src/utils/soundEngine.ts` — Procedural Web Audio API synthesizer and live microphone FFT frequency analyzer.
- `src/utils/voiceManager.ts` — Web Speech API recognition (with live interim transcription) and `speechSynthesis` text-to-speech manager.
- `src/utils/handTracker.ts` — Optional MediaPipe Hand Landmarker controller (`@mediapipe/tasks-vision`) supporting open-palm awaken, pinch rotate, proximity zoom, and closed-fist pause.
- `src/components/` — `AudioWaveform.tsx`, `HistoryDrawer.tsx`, `SettingsModal.tsx`.
- `src/App.tsx` — Main HUD overlay, mode switcher, collapsible command dock, and cognitive state orchestration.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (`.env` or AI Studio Secrets):
   - `GEMINI_API_KEY`: Your Gemini API key (accessed server-side only).
   - `PORT`: Server port (defaults to `3000`).
3. Run in development:
   ```bash
   npm run dev
   ```
4. Build and run for production:
   ```bash
   npm run build
   npm start
   ```
