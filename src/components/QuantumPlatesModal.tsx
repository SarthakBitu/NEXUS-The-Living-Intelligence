import { useState } from 'react';
import { Atom, Sparkles, X } from 'lucide-react';

export interface QuantumPlate {
  id: string;
  title: string;
  formula: string;
  description: string;
  src: string;
}

const QUANTUM_PLATES: QuantumPlate[] = [
  {
    id: 'plate-001',
    title: 'Dipole Caustic Horizon',
    formula: 'r(θ) = R · sin²(θ)',
    description:
      'Gossamer dipole field envelope arching over a horizontal focal plane and concentric orbital horizons.',
    src: '/assets/aistudio/2023-Amy-Karle-Quantum-Concepts-001-400x284_0aaa9467.webp',
  },
  {
    id: 'plate-021',
    title: 'Dual-Focus Orbital Bridge',
    formula: 'Φ(r₁, r₂) = ψ₁ ⊗ ψ₂',
    description:
      'Intersecting twin focal spheres linked by hyperbolic phase bridges along a calibrated Cartesian grid.',
    src: '/assets/aistudio/2023-Amy-Karle-Quantum-Concepts-021-400x284_393618e6.png',
  },
  {
    id: 'plate-010',
    title: 'Lemniscate Singularity & Bead Orbits',
    formula: 'r² = a² · cos(2θ)',
    description:
      'Figure-eight dipole filaments pinching through a blazing core singularity surrounded by discrete bead rings.',
    src: '/assets/aistudio/2023-Amy-Karle-Quantum-Concepts-010-400x284_1db057a1.png',
  },
  {
    id: 'plate-020',
    title: 'Harmonic Interference Fan',
    formula: 'Ψ(x,y) = Σ cₙ · e^(i kₙ·r)',
    description:
      'Symmetric parabolic caustic fan converging on vertical poles and central quadrupole interference nodes.',
    src: '/assets/aistudio/2023-Amy-Karle-Quantum-Concepts-020-400x284_db87038b.webp',
  },
  {
    id: 'plate-008',
    title: 'Hourglass Geodesic Manifold',
    formula: '∮ B · dA = n · Φ₀',
    description:
      'Woven hourglass manifold nested inside concentric spherical geodesic meridians and radial rays.',
    src: '/assets/aistudio/2023-Amy-Karle-Quantum-Concepts-008-400x284_f71f2e5e.webp',
  },
  {
    id: 'plate-002',
    title: 'Bipolar Field Harmonics',
    formula: '∇²ψ + (2m/ℏ²)(E − V)ψ = 0',
    description:
      'Twin tangent dipole lobes flaring outward at horizontal poles across fine coordinate crosshairs.',
    src: '/assets/aistudio/2023-Amy-Karle-Quantum-Concepts-002-400x284_617f5b61.webp',
  },
];

interface QuantumPlatesModalProps {
  open: boolean;
  onClose: () => void;
  onActivateQuantum: (plate: QuantumPlate) => void;
}

export function QuantumPlatesModal({
  open,
  onClose,
  onActivateQuantum,
}: QuantumPlatesModalProps) {
  const [selectedId, setSelectedId] = useState<string>(QUANTUM_PLATES[0].id);

  if (!open) return null;

  const activePlate =
    QUANTUM_PLATES.find((p) => p.id === selectedId) ?? QUANTUM_PLATES[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quantum concept plates"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        className="w-[min(860px,96vw)] max-h-[88vh] flex flex-col rounded-xl bg-[#070a12]/96 border border-white/12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Atom className="w-4 h-4 text-red-400" />
            <div>
              <h2 className="font-[var(--font-display)] text-sm sm:text-base font-semibold tracking-wide text-slate-100">
                Quantum Concept Plates
              </h2>
              <p className="text-[11px] text-slate-400">
                Dipole caustics, lemniscate singularities & geodesic wave manifolds
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close quantum concept plates"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto nexus-scroll p-5 space-y-5">
          {/* Featured Active Plate */}
          <div className="grid grid-cols-1 md:grid-cols-[1.35fr_1fr] gap-4 rounded-xl bg-black/60 border border-white/10 p-3.5">
            <div className="relative rounded-lg overflow-hidden bg-black border border-white/8 aspect-[400/284]">
              <img
                src={activePlate.src}
                alt={activePlate.title}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col justify-between gap-3 py-1">
              <div className="space-y-2">
                <span className="inline-block font-mono text-[11px] text-red-300/90 bg-red-500/10 border border-red-400/25 px-2.5 py-0.5 rounded-md">
                  {activePlate.formula}
                </span>
                <h3 className="font-[var(--font-display)] text-base font-semibold text-slate-100">
                  {activePlate.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  {activePlate.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onActivateQuantum(activePlate);
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-100 border border-red-400/40 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Project in 3D Quantum Core</span>
              </button>
            </div>
          </div>

          {/* Thumbnail Grid of All 6 Plates */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {QUANTUM_PLATES.map((plate) => {
              const isSelected = plate.id === activePlate.id;
              return (
                <button
                  key={plate.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(plate.id);
                    onActivateQuantum(plate);
                  }}
                  className={`group text-left rounded-lg overflow-hidden border transition-colors cursor-pointer bg-black/70 ${
                    isSelected
                      ? 'border-red-400/60 ring-1 ring-red-400/30'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="aspect-[400/284] bg-black overflow-hidden">
                    <img
                      src={plate.src}
                      alt={plate.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </div>
                  <div className="px-2.5 py-2 border-t border-white/8">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {plate.title}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400 truncate mt-0.5">
                      {plate.formula}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
