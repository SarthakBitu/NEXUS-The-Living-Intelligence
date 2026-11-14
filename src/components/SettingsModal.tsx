import { RotateCcw, X } from 'lucide-react';
import type { GraphicsQuality, NexusSettings } from '../types/nexus';

interface SettingsModalProps {
  open: boolean;
  settings: NexusSettings;
  voices: SpeechSynthesisVoice[];
  onClose: () => void;
  onUpdate: (partial: Partial<NexusSettings>) => void;
  onResetExperience: () => void;
}

export function SettingsModal({
  open,
  settings,
  voices,
  onClose,
  onUpdate,
  onResetExperience,
}: SettingsModalProps) {
  if (!open) return null;

  const qualities: { value: GraphicsQuality; label: string; detail: string }[] = [
    { value: 'high', label: 'High', detail: '24k particles · Full bloom' },
    { value: 'balanced', label: 'Balanced', detail: '14k particles · Soft bloom' },
    { value: 'performance', label: 'Performance', detail: '7.2k particles · Direct pass' },
  ];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nexus-settings-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-[#080c16] border border-white/12 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2
            id="nexus-settings-title"
            className="font-[var(--font-display)] text-base font-semibold text-slate-100"
          >
            Interface & Engine Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto nexus-scroll">
          {/* Graphics Quality */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Graphics Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {qualities.map((q) => {
                const active = settings.quality === q.value;
                return (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => onUpdate({ quality: q.value })}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-400/12 border-emerald-400/50 text-emerald-200'
                        : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{q.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {q.detail}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label
              htmlFor="tts-voice-select"
              className="block text-xs font-medium text-slate-300"
            >
              Synthesized Voice
            </label>
            <select
              id="tts-voice-select"
              value={settings.selectedVoiceURI}
              onChange={(e) => onUpdate({ selectedVoiceURI: e.target.value })}
              className="w-full rounded-lg bg-[#0d1322] border border-white/12 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400/60"
            >
              <option value="">System Default Neural Voice</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Speak AI Responses Aloud
                </div>
                <div className="text-[11px] text-slate-400">
                  Synchronizes neural light pulses with text-to-speech cadence
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={(e) => onUpdate({ autoSpeak: e.target.checked })}
                className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Ambient Spatial Audio
                </div>
                <div className="text-[11px] text-slate-400">
                  Procedural Web Audio chimes and transition resonance
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => onUpdate({ soundEnabled: e.target.checked })}
                className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Quantum Style Sketches
                </div>
                <div className="text-[11px] text-slate-400">
                  Renders orbital wavefunctions, harmonic contours, and entanglement arcs
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.quantumSketches}
                onChange={(e) => onUpdate({ quantumSketches: e.target.checked })}
                className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-slate-200">
                  Reduced Motion
                </div>
                <div className="text-[11px] text-slate-400">
                  Dampens particle turbulence, oscillation, and rotation velocity
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => onUpdate({ reducedMotion: e.target.checked })}
                className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Gesture & Controls Guide */}
          <div className="rounded-lg bg-white/[0.03] border border-white/8 p-3.5 space-y-2">
            <div className="text-xs font-medium text-slate-200">
              Spatial & Gesture Controls
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
              <span>Mouse / Touch Drag</span>
              <span className="text-slate-300">Rotate 3D entity</span>
              <span>Scroll / Pinch</span>
              <span className="text-slate-300">Zoom depth</span>
              <span>Single Click</span>
              <span className="text-slate-300">Emit pulse / Awaken orb</span>
              <span>Double Click</span>
              <span className="text-slate-300">Morph next formation</span>
              <span>Hand: Open Palm</span>
              <span className="text-slate-300">Awaken / Proximity zoom</span>
              <span>Hand: Pinch / Fist</span>
              <span className="text-slate-300">Rotate / Pause motion</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => {
              onResetExperience();
              onClose();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Experience
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
