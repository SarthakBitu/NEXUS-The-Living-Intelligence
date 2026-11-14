// Optional MediaPipe Hand Landmarker controller for touchless 3D gestures

export type HandGestureType =
  | 'none'
  | 'open_palm'
  | 'pinch'
  | 'closed_fist';

export interface HandGestureCallbacks {
  onGestureState?: (gesture: HandGestureType) => void;
  onAwakenGesture?: () => void;
  onRotateZoom?: (rotateX: number, rotateY: number, zoomDelta: number) => void;
  onPauseToggle?: (paused: boolean) => void;
  onError?: (message: string) => void;
}

interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface HandLandmarkerLike {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => { landmarks?: Landmark[][] };
  close: () => void;
}

export class HandTracker {
  private landmarker: HandLandmarkerLike | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId = 0;
  private running = false;
  private callbacks: HandGestureCallbacks = {};

  private prevPinchPos: { x: number; y: number } | null = null;
  private prevSpan: number | null = null;
  private lastPalmTrigger = 0;
  private lastFistState = false;
  private pausedByFist = false;

  public async start(
    videoEl: HTMLVideoElement,
    callbacks: HandGestureCallbacks
  ): Promise<boolean> {
    this.callbacks = callbacks;
    this.video = videoEl;

    if (!navigator.mediaDevices?.getUserMedia) {
      callbacks.onError?.('Webcam access is unavailable in this browser.');
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      videoEl.srcObject = this.stream;
      await videoEl.play();

      const vision = await import('@mediapipe/tasks-vision');
      const resolver = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      this.landmarker = (await vision.HandLandmarker.createFromOptions(
        resolver,
        {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        }
      )) as unknown as HandLandmarkerLike;

      this.running = true;
      this.loop();
      return true;
    } catch (err) {
      this.stop();
      callbacks.onError?.(
        err instanceof Error
          ? `Hand tracking unavailable: ${err.message}`
          : 'Unable to initialize webcam hand tracking.'
      );
      return false;
    }
  }

  private loop = () => {
    if (!this.running || !this.video || !this.landmarker) return;

    if (this.video.readyState >= 2) {
      const now = performance.now();
      const result = this.landmarker.detectForVideo(this.video, now);
      const hand = result.landmarks?.[0];

      if (hand && hand.length >= 21) {
        this.processLandmarks(hand, now);
      } else {
        this.prevPinchPos = null;
        this.prevSpan = null;
        this.callbacks.onGestureState?.('none');
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private processLandmarks(lm: Landmark[], now: number) {
    const wrist = lm[0];
    const thumbTip = lm[4];
    const indexMcp = lm[5];
    const indexTip = lm[8];
    const middleMcp = lm[9];
    const middleTip = lm[12];
    const ringTip = lm[16];
    const pinkyTip = lm[20];

    const dist = (a: Landmark, b: Landmark) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const handSpan = Math.max(0.05, dist(wrist, middleMcp));
    const pinchDist = dist(thumbTip, indexTip) / handSpan;

    // Count extended fingers (tip farther from wrist than MCP/base)
    const indexExt = dist(wrist, indexTip) > dist(wrist, indexMcp) * 1.28;
    const middleExt = dist(wrist, middleTip) > dist(wrist, middleMcp) * 1.28;
    const ringExt = dist(wrist, ringTip) > handSpan * 1.15;
    const pinkyExt = dist(wrist, pinkyTip) > handSpan * 1.05;
    const extendedCount =
      Number(indexExt) +
      Number(middleExt) +
      Number(ringExt) +
      Number(pinkyExt);

    // 1. Closed Fist -> Pause / Unpause
    if (extendedCount === 0 && pinchDist > 0.25) {
      this.callbacks.onGestureState?.('closed_fist');
      if (!this.lastFistState) {
        this.lastFistState = true;
        this.pausedByFist = !this.pausedByFist;
        this.callbacks.onPauseToggle?.(this.pausedByFist);
      }
      this.prevPinchPos = null;
      this.prevSpan = null;
      return;
    }
    this.lastFistState = false;

    // 2. Pinch -> Grab & Rotate Brain
    if (pinchDist < 0.36) {
      this.callbacks.onGestureState?.('pinch');
      const cx = (thumbTip.x + indexTip.x) * 0.5;
      const cy = (thumbTip.y + indexTip.y) * 0.5;

      let rotX = 0;
      let rotY = 0;
      if (this.prevPinchPos) {
        rotY = (this.prevPinchPos.x - cx) * 5.2;
        rotX = (cy - this.prevPinchPos.y) * 3.8;
      }
      this.prevPinchPos = { x: cx, y: cy };

      let zoomDelta = 0;
      if (this.prevSpan !== null) {
        const spanDiff = handSpan - this.prevSpan;
        if (Math.abs(spanDiff) > 0.004) {
          zoomDelta = -spanDiff * 16.0;
        }
      }
      this.prevSpan = handSpan;

      this.callbacks.onRotateZoom?.(rotX, rotY, zoomDelta);
      return;
    }
    this.prevPinchPos = null;

    // 3. Open Palm -> Awaken + Proximity Zoom
    if (extendedCount >= 4) {
      this.callbacks.onGestureState?.('open_palm');
      if (now - this.lastPalmTrigger > 3200) {
        this.lastPalmTrigger = now;
        this.callbacks.onAwakenGesture?.();
      }
      if (this.prevSpan !== null) {
        const spanDiff = handSpan - this.prevSpan;
        if (Math.abs(spanDiff) > 0.004) {
          this.callbacks.onRotateZoom?.(0, 0, -spanDiff * 14.0);
        }
      }
      this.prevSpan = handSpan;
      return;
    }

    this.prevSpan = handSpan;
    this.callbacks.onGestureState?.('none');
  }

  public stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // ignore
      }
      this.landmarker = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.prevPinchPos = null;
    this.prevSpan = null;
  }
}
