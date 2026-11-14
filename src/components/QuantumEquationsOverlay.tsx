import { useEffect, useRef } from 'react';

interface QuantumEquationsOverlayProps {
  active: boolean;
  reducedMotion: boolean;
}

interface EquationNode {
  text: string;
  tag: string;
  nx: number;
  ny: number;
  depth: number;
  phase: number;
  speed: number;
  tone: 'red' | 'violet' | 'rose';
}

const EQUATIONS: EquationNode[] = [
  { text: 'iℏ ∂ψ/∂t = Ĥψ', tag: 'SCHRÖDINGER', nx: 0.14, ny: 0.22, depth: 0.92, phase: 0.2, speed: 0.55, tone: 'rose' },
  { text: 'Δx · Δp ≥ ℏ / 2', tag: 'HEISENBERG', nx: 0.84, ny: 0.20, depth: 0.85, phase: 1.1, speed: 0.48, tone: 'violet' },
  { text: '|ψ⟩ = cos(θ/2)|0⟩ + e^(iφ)sin(θ/2)|1⟩', tag: 'BLOCH STATE', nx: 0.18, ny: 0.42, depth: 0.68, phase: 2.3, speed: 0.42, tone: 'red' },
  { text: 'r(θ) = R · sin²(θ)', tag: 'DIPOLE', nx: 0.82, ny: 0.38, depth: 0.78, phase: 3.1, speed: 0.52, tone: 'rose' },
  { text: 'r² = a² · cos(2θ)', tag: 'LEMNISCATE', nx: 0.12, ny: 0.62, depth: 0.74, phase: 4.0, speed: 0.44, tone: 'violet' },
  { text: '∇²ψ + (2m/ℏ²)(E − V)ψ = 0', tag: 'EIGENVALUE', nx: 0.80, ny: 0.60, depth: 0.88, phase: 0.8, speed: 0.46, tone: 'red' },
  { text: '[x̂, p̂] = iℏ', tag: 'CANONICAL', nx: 0.24, ny: 0.75, depth: 0.56, phase: 1.9, speed: 0.62, tone: 'rose' },
  { text: '∮ B · dA = nΦ₀', tag: 'FLUX QUANTUM', nx: 0.76, ny: 0.74, depth: 0.64, phase: 2.7, speed: 0.50, tone: 'violet' },
  { text: '⟨φ|ψ⟩ = ∫ φ*(r)ψ(r) d³r', tag: 'INNER PRODUCT', nx: 0.30, ny: 0.16, depth: 0.50, phase: 3.6, speed: 0.38, tone: 'violet' },
  { text: 'S = −k_B Tr(ρ ln ρ)', tag: 'VON NEUMANN', nx: 0.68, ny: 0.17, depth: 0.54, phase: 4.9, speed: 0.41, tone: 'red' },
  { text: 'Ψ(x,t) = A · e^(i(kx − ωt))', tag: 'WAVE PACKET', nx: 0.10, ny: 0.33, depth: 0.45, phase: 5.2, speed: 0.35, tone: 'rose' },
  { text: 'P(a) = |⟨a|ψ⟩|²', tag: 'BORN RULE', nx: 0.90, ny: 0.49, depth: 0.60, phase: 1.4, speed: 0.58, tone: 'rose' },
  { text: 'F_μν = ∂_μA_ν − ∂_νA_μ', tag: 'GAUGE FIELD', nx: 0.86, ny: 0.29, depth: 0.46, phase: 2.8, speed: 0.36, tone: 'violet' },
  { text: 'e^(iπ) + 1 = 0', tag: 'EULER', nx: 0.16, ny: 0.51, depth: 0.48, phase: 0.5, speed: 0.53, tone: 'red' },
  { text: 'λ = h / p', tag: 'DE BROGLIE', nx: 0.72, ny: 0.48, depth: 0.42, phase: 3.9, speed: 0.47, tone: 'rose' },
  { text: 'Ĥ|ψₙ⟩ = Eₙ|ψₙ⟩', tag: 'HAMILTONIAN', nx: 0.28, ny: 0.69, depth: 0.40, phase: 4.4, speed: 0.40, tone: 'violet' },
];

const TONE_RGB: Record<EquationNode['tone'], [number, number, number]> = {
  red: [248, 113, 113],
  rose: [244, 164, 178],
  violet: [192, 162, 252],
};

export function QuantumEquationsOverlay({
  active,
  reducedMotion,
}: QuantumEquationsOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();

    const targetCursor = { x: width * 0.5, y: height * 0.5, inside: false };
    const smoothCursor = { x: width * 0.5, y: height * 0.5 };
    let visibility = activeRef.current ? 1 : 0;

    const onPointerMove = (e: PointerEvent) => {
      targetCursor.x = e.clientX;
      targetCursor.y = e.clientY;
      targetCursor.inside = true;
    };

    const onPointerLeave = () => {
      targetCursor.inside = false;
      targetCursor.x = width * 0.5;
      targetCursor.y = height * 0.5;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);

    let rafId = 0;
    const startTime = performance.now();

    const draw = (now: number) => {
      const targetVis = activeRef.current ? 1 : 0;
      visibility += (targetVis - visibility) * 0.08;

      if (visibility < 0.005 && !activeRef.current) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafId = requestAnimationFrame(draw);
        return;
      }

      // Smooth damped cursor tracking
      smoothCursor.x += (targetCursor.x - smoothCursor.x) * 0.075;
      smoothCursor.y += (targetCursor.y - smoothCursor.y) * 0.075;

      const offsetX = smoothCursor.x - width * 0.5;
      const offsetY = smoothCursor.y - height * 0.5;
      const t = (now - startTime) * 0.001;
      const motion = reducedRef.current ? 0.08 : 1.0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Subtle cursor quantum coordinate crosshair when active & moving
      if (targetCursor.inside && visibility > 0.05) {
        const cx = smoothCursor.x;
        const cy = smoothCursor.y;
        const ringAlpha = 0.14 * visibility;
        ctx.strokeStyle = `rgba(248, 113, 113, ${ringAlpha})`;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(192, 162, 252, ${ringAlpha * 0.75})`;
        ctx.beginPath();
        ctx.moveTo(cx - 32, cy);
        ctx.lineTo(cx - 10, cy);
        ctx.moveTo(cx + 10, cy);
        ctx.lineTo(cx + 32, cy);
        ctx.moveTo(cx, cy - 32);
        ctx.lineTo(cx, cy - 10);
        ctx.moveTo(cx, cy + 10);
        ctx.lineTo(cx, cy + 32);
        ctx.stroke();
      }

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';

      const maxParallax = Math.min(width, height) * 0.048;

      for (let i = 0; i < EQUATIONS.length; i++) {
        const eq = EQUATIONS[i];
        const driftX = Math.sin(t * eq.speed + eq.phase) * 12 * motion;
        const driftY = Math.cos(t * eq.speed * 0.82 + eq.phase * 1.3) * 9 * motion;

        // Parallax gently tracks cursor inversely/proportionally by depth
        const px =
          eq.nx * width +
          driftX +
          (offsetX / Math.max(1, width * 0.5)) * maxParallax * eq.depth;
        const py =
          eq.ny * height +
          driftY +
          (offsetY / Math.max(1, height * 0.5)) * maxParallax * eq.depth;

        const dx = px - smoothCursor.x;
        const dy = py - smoothCursor.y;
        const dist = Math.hypot(dx, dy);
        const proximity = targetCursor.inside
          ? Math.max(0, 1 - dist / 240)
          : 0;

        // Slight magnetic attraction toward the cursor when nearby
        const pull = proximity * proximity * 14 * eq.depth * motion;
        const finalX = dist > 1 ? px - (dx / dist) * pull : px;
        const finalY = dist > 1 ? py - (dy / dist) * pull : py;

        const pulse = 0.72 + 0.28 * Math.sin(t * 1.15 + eq.phase);
        const baseAlpha = (0.14 + eq.depth * 0.14) * pulse;
        const alpha = Math.min(0.62, (baseAlpha + proximity * 0.30) * visibility);

        const [r, g, b] = TONE_RGB[eq.tone];
        const fontSize = Math.round(10.5 + eq.depth * 3.5);

        ctx.font = `500 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillText(eq.text, finalX, finalY);

        // Micro tag & bracket reticle appear subtly when cursor approaches
        if (proximity > 0.12) {
          const tagAlpha = alpha * 0.65 * proximity;
          ctx.font = `600 8.5px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.fillStyle = `rgba(244, 164, 178, ${tagAlpha})`;
          ctx.fillText(eq.tag, finalX, finalY - fontSize * 0.95);

          // Delicate hairline tether to cursor region
          if (proximity > 0.35) {
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.09 * proximity * visibility})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(finalX, finalY + fontSize * 0.75);
            ctx.lineTo(
              finalX + (smoothCursor.x - finalX) * 0.22,
              finalY + (smoothCursor.y - finalY) * 0.22
            );
            ctx.stroke();
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-10 pointer-events-none"
    />
  );
}
