import { useEffect, useRef } from 'react';
import type { CognitiveState } from '../types/nexus';

interface AudioWaveformProps {
  bins: number[];
  state: CognitiveState;
  active: boolean;
}

export function AudioWaveform({ bins, state, active }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barCount = 24;
    const gap = 3;
    const barWidth = (w - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      let amp = 0.08;
      if (active && bins.length > 0) {
        amp = Math.max(0.1, bins[i % bins.length] ?? 0.1);
      } else if (state === 'thinking') {
        amp = 0.25 + 0.45 * Math.abs(Math.sin(performance.now() * 0.006 + i * 0.45));
      } else if (state === 'responding') {
        amp = 0.3 + 0.55 * Math.abs(Math.sin(performance.now() * 0.008 + i * 0.6));
      } else if (state === 'error') {
        amp = 0.5;
      }

      const barH = Math.max(3, amp * (h - 4));
      const x = i * (barWidth + gap);
      const y = (h - barH) / 2;

      if (state === 'error') {
        ctx.fillStyle = '#f97316';
      } else if (state === 'thinking' || state === 'responding') {
        ctx.fillStyle = i % 2 === 0 ? '#8b5cf6' : '#2ef2b8';
      } else if (active) {
        ctx.fillStyle = '#2ef2b8';
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 1.5);
      ctx.fill();
    }
  }, [bins, state, active]);

  return (
    <canvas
      ref={canvasRef}
      width={124}
      height={24}
      className="shrink-0"
      aria-hidden="true"
    />
  );
}
