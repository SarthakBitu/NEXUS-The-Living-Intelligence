import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Atom,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Hand,
  History,
  Images,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Radio,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { NexusEngine } from './engine/NexusEngine';
import { soundEngine } from './utils/soundEngine';
import { voiceManager } from './utils/voiceManager';
import { HandTracker, type HandGestureType } from './utils/handTracker';
import { AudioWaveform } from './components/AudioWaveform';
import { HistoryDrawer } from './components/HistoryDrawer';
import { QuantumEquationsOverlay } from './components/QuantumEquationsOverlay';
import { QuantumPlatesModal } from './components/QuantumPlatesModal';
import { SettingsModal } from './components/SettingsModal';
import type {
  ApiChatResponse,
  BrainRegion,
  ChatMessage,
  CognitiveState,
  NexusSettings,
  VisualMode,
} from './types/nexus';

const MODES: { id: VisualMode; label: string }[] = [
  { id: 'orb', label: 'Orb' },
  { id: 'galaxy', label: 'Galaxy' },
  { id: 'brain', label: 'Brain' },
  { id: 'neural', label: 'Neural' },
  { id: 'consciousness', label: 'Consciousness' },
  { id: 'quantum', label: 'Quantum' },
];

const STATE_META: Record<
  CognitiveState,
  { label: string; colorClass: string }
> = {
  idle: { label: 'Idle', colorClass: 'text-slate-300' },
  listening: { label: 'Listening', colorClass: 'text-emerald-300' },
  thinking: { label: 'Thinking', colorClass: 'text-violet-300' },
  responding: { label: 'Responding', colorClass: 'text-emerald-200' },
  error: { label: 'Error', colorClass: 'text-orange-400' },
  success: { label: 'Synchronized', colorClass: 'text-emerald-300' },
};

const REGION_NAMES: Record<BrainRegion, string> = {
  prefrontal: 'Prefrontal',
  temporal: 'Temporal',
  parietal: 'Parietal',
  occipital: 'Occipital',
  cerebellum: 'Cerebellum',
};

const GESTURE_LABELS: Record<HandGestureType, string> = {
  none: 'Hand ready',
  open_palm: 'Open palm · Awaken / Zoom',
  pinch: 'Pinch · Rotate entity',
  closed_fist: 'Closed fist · Pause toggle',
};

function renderStateIcon(state: CognitiveState) {
  switch (state) {
    case 'listening':
      return <Radio className="w-3.5 h-3.5 text-emerald-400" />;
    case 'thinking':
      return <Brain className="w-3.5 h-3.5 text-violet-400" />;
    case 'responding':
      return <Waves className="w-3.5 h-3.5 text-emerald-300" />;
    case 'error':
      return <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />;
    case 'success':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    default:
      return <Sparkles className="w-3.5 h-3.5 text-slate-400" />;
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NexusEngine | null>(null);
  const handVideoRef = useRef<HTMLVideoElement | null>(null);
  const handTrackerRef = useRef<HandTracker | null>(null);

  const [visualMode, setVisualMode] = useState<VisualMode>('orb');
  const [cognitiveState, setCognitiveState] = useState<CognitiveState>('idle');
  const [hasAwakened, setHasAwakened] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestReply, setLatestReply] = useState<ChatMessage | null>(null);
  const [inputText, setInputText] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [audioBins, setAudioBins] = useState<number[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [platesOpen, setPlatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [handGesture, setHandGesture] = useState<HandGestureType>('none');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [noticeText, setNoticeText] = useState<string | null>(null);

  const [settings, setSettings] = useState<NexusSettings>(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return {
      quality: 'high',
      reducedMotion: Boolean(prefersReduced),
      soundEnabled: true,
      autoSpeak: true,
      selectedVoiceURI: '',
      handTrackingEnabled: false,
      quantumSketches: true,
    };
  });

  // Refs for latest callbacks inside WebGL & voice listeners
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const visualModeRef = useRef(visualMode);
  visualModeRef.current = visualMode;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const showNotice = useCallback((msg: string) => {
    setNoticeText(msg);
    window.setTimeout(() => {
      setNoticeText((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const triggerAwakenSequence = useCallback(() => {
    if (!engineRef.current) return;
    setHasAwakened(true);
    setCognitiveState('success');
    soundEngine.playAwakenChord();
    engineRef.current.triggerAwaken();
    window.setTimeout(() => {
      setCognitiveState((prev) => (prev === 'success' ? 'idle' : prev));
    }, 1800);
  }, []);

  // Initialize Three.js WebGL Engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    try {
      const engine = new NexusEngine(mount, {
        onModeChange: (mode) => {
          if (visualModeRef.current !== mode) {
            visualModeRef.current = mode;
            soundEngine.playModeTransition(mode);
          }
          setVisualMode(mode);
        },
        onAwakenRequest: () => {
          triggerAwakenSequence();
        },
        onContextLost: (lost) => {
          setWebglError(
            lost
              ? 'WebGL context was interrupted. Attempting to restore visual core...'
              : null
          );
        },
      });
      engine.setQuality(settingsRef.current.quality);
      engine.setReducedMotion(settingsRef.current.reducedMotion);
      engine.setQuantumSketches(settingsRef.current.quantumSketches);
      engineRef.current = engine;

      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    } catch {
      setWebglError(
        'WebGL rendering is unavailable on this device. Text conversation remains active.'
      );
    }
  }, [triggerAwakenSequence]);

  // Sync engine settings
  useEffect(() => {
    engineRef.current?.setQuality(settings.quality);
  }, [settings.quality]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(settings.reducedMotion);
  }, [settings.reducedMotion]);

  useEffect(() => {
    soundEngine.setEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  useEffect(() => {
    engineRef.current?.setQuantumSketches(settings.quantumSketches);
  }, [settings.quantumSketches]);

  // Load TTS voices
  useEffect(() => {
    const loadVoices = () => setVoices(voiceManager.getVoices());
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Fullscreen listener
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Keyboard shortcut 'H' to toggle HUD Cinema mode when not typing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Audio-reactive loop for microphone & TTS response waves
  useEffect(() => {
    if (!micActive && !isSpeaking) {
      engineRef.current?.setAudioMetrics(0, 0, 0);
      setAudioBins([]);
      return;
    }

    let raf = 0;
    let lastUiUpdate = 0;

    const updateAudio = (now: number) => {
      if (micActive) {
        const metrics = soundEngine.getMicrophoneMetrics();
        engineRef.current?.setAudioMetrics(
          metrics.level,
          metrics.bass,
          metrics.treble
        );
        if (now - lastUiUpdate > 50) {
          lastUiUpdate = now;
          setAudioBins(metrics.bins);
        }
      } else if (isSpeaking) {
        // Organic vocal envelope while TTS is speaking
        const t = now * 0.009;
        const level = 0.25 + 0.35 * Math.abs(Math.sin(t) * Math.cos(t * 0.63));
        const bass = level * 0.85;
        const treble = level * 1.1;
        engineRef.current?.setAudioMetrics(level, bass, treble);
        if (now - lastUiUpdate > 60) {
          lastUiUpdate = now;
          const simBins = Array.from({ length: 24 }, (_, idx) =>
            Math.max(0.12, Math.abs(Math.sin(t * 1.3 + idx * 0.45)) * level * 1.8)
          );
          setAudioBins(simBins);
        }
      }
      raf = requestAnimationFrame(updateAudio);
    };

    raf = requestAnimationFrame(updateAudio);
    return () => cancelAnimationFrame(raf);
  }, [micActive, isSpeaking]);

  const handleModeSwitch = useCallback((mode: VisualMode) => {
    setHasAwakened(true);
    visualModeRef.current = mode;
    setVisualMode(mode);
    engineRef.current?.setMode(mode);
    soundEngine.playModeTransition(mode);
  }, []);

  const handleResetExperience = useCallback(() => {
    const alreadyOrb = visualModeRef.current === 'orb';
    voiceManager.cancelSpeech();
    setIsSpeaking(false);
    setHasAwakened(false);
    setLatestReply(null);
    setMessages([]);
    setCognitiveState('idle');
    engineRef.current?.resetExperience();
    if (alreadyOrb) {
      soundEngine.playModeTransition('orb');
    }
  }, []);

  const submitCommand = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      const lower = trimmed.toLowerCase();

      // Immediate local voice/text command shortcuts
      if (lower === 'awaken' || lower === 'wake up') {
        const userMsg: ChatMessage = {
          id: `${Date.now()}-u`,
          role: 'user',
          text: trimmed,
          timestamp: Date.now(),
        };
        const sysMsg: ChatMessage = {
          id: `${Date.now()}-a`,
          role: 'assistant',
          text: 'Consciousness awakened. Neural pathways online and listening.',
          timestamp: Date.now(),
          regions: ['prefrontal', 'occipital', 'cerebellum'],
        };
        setMessages((prev) => [...prev, userMsg, sysMsg]);
        setLatestReply(sysMsg);
        triggerAwakenSequence();
        if (settingsRef.current.autoSpeak) {
          voiceManager.speak(sysMsg.text, settingsRef.current.selectedVoiceURI, {
            onSpeakStart: () => setIsSpeaking(true),
            onSpeakEnd: () => setIsSpeaking(false),
          });
        }
        return;
      }

      if (lower === 'reset' || lower === 'reset experience') {
        handleResetExperience();
        return;
      }

      const directModeMatch: Record<string, VisualMode> = {
        'orb mode': 'orb',
        'galaxy mode': 'galaxy',
        'brain mode': 'brain',
        'neural mode': 'neural',
        'consciousness mode': 'consciousness',
        'quantum mode': 'quantum',
      };
      if (directModeMatch[lower]) {
        handleModeSwitch(directModeMatch[lower]);
      }

      if (lower.includes('toggle quantum sketch') || lower === 'toggle sketches') {
        setSettings((p) => ({ ...p, quantumSketches: !p.quantumSketches }));
      } else if (lower === 'show quantum sketches' || lower === 'show sketches') {
        setSettings((p) => ({ ...p, quantumSketches: true }));
      } else if (lower === 'hide quantum sketches' || lower === 'hide sketches') {
        setSettings((p) => ({ ...p, quantumSketches: false }));
      }

      const userMsg: ChatMessage = {
        id: `${Date.now()}-u`,
        role: 'user',
        text: trimmed,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      setCognitiveState('thinking');
      engineRef.current?.setCognitiveState('thinking');
      engineRef.current?.setActivatedRegions(['prefrontal', 'temporal']);
      soundEngine.playPulse(310, 0.18, 0.035);

      try {
        const historyPayload = messagesRef.current
          .filter((m) => m.role !== 'system' && !m.isError)
          .slice(-10)
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            text: m.text,
          }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            currentMode: visualModeRef.current,
          }),
        });

        const data = (await res.json()) as ApiChatResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        // Apply AI-directed mode transformation if requested
        if (data.suggestedMode === 'awaken') {
          triggerAwakenSequence();
        } else if (data.suggestedMode === 'reset') {
          handleResetExperience();
        } else if (
          data.suggestedMode &&
          ['orb', 'galaxy', 'brain', 'neural', 'consciousness', 'quantum'].includes(
            data.suggestedMode
          )
        ) {
          handleModeSwitch(data.suggestedMode as VisualMode);
        } else if (visualModeRef.current === 'orb') {
          // Automatically awaken into Brain when holding a conversation
          triggerAwakenSequence();
        }

        const regions: BrainRegion[] =
          data.activatedRegions?.length > 0
            ? data.activatedRegions
            : ['prefrontal'];

        engineRef.current?.setActivatedRegions(regions);

        const aiMsg: ChatMessage = {
          id: `${Date.now()}-a`,
          role: 'assistant',
          text: data.reply,
          timestamp: Date.now(),
          regions,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setLatestReply(aiMsg);

        if (data.sentiment === 'success') {
          setCognitiveState('success');
          engineRef.current?.setCognitiveState('success');
          soundEngine.playSuccessChime();
        } else {
          setCognitiveState('responding');
          engineRef.current?.setCognitiveState('responding');
          soundEngine.playPulse(440, 0.25, 0.04);
        }

        if (settingsRef.current.autoSpeak) {
          voiceManager.speak(data.reply, settingsRef.current.selectedVoiceURI, {
            onSpeakStart: () => {
              setIsSpeaking(true);
              setCognitiveState('responding');
              engineRef.current?.setCognitiveState('responding');
            },
            onSpeakEnd: () => {
              setIsSpeaking(false);
              setCognitiveState(micActive ? 'listening' : 'idle');
              engineRef.current?.setCognitiveState(
                micActive ? 'listening' : 'idle'
              );
            },
          });
        } else {
          window.setTimeout(() => {
            setCognitiveState(micActive ? 'listening' : 'idle');
            engineRef.current?.setCognitiveState(
              micActive ? 'listening' : 'idle'
            );
          }, 2200);
        }
      } catch (err) {
        const errorText =
          err instanceof Error
            ? err.message
            : 'Unable to reach neural intelligence service.';
        setCognitiveState('error');
        engineRef.current?.setCognitiveState('error');
        soundEngine.playErrorTone();

        const errMsg: ChatMessage = {
          id: `${Date.now()}-e`,
          role: 'assistant',
          text: errorText,
          timestamp: Date.now(),
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setLatestReply(errMsg);

        window.setTimeout(() => {
          setCognitiveState(micActive ? 'listening' : 'idle');
          engineRef.current?.setCognitiveState(
            micActive ? 'listening' : 'idle'
          );
        }, 2500);
      }
    },
    [handleModeSwitch, handleResetExperience, micActive, triggerAwakenSequence]
  );

  // Microphone & Speech Recognition toggle
  const toggleMicrophone = useCallback(async () => {
    if (micActive) {
      voiceManager.stopListening();
      soundEngine.stopMicrophone();
      setMicActive(false);
      setInterimTranscript('');
      setCognitiveState('idle');
      engineRef.current?.setCognitiveState('idle');
      return;
    }

    const micOk = await soundEngine.startMicrophone();
    if (!micOk) {
      showNotice(
        'Microphone access unavailable or denied. Use text input below.'
      );
      setCognitiveState('error');
      engineRef.current?.setCognitiveState('error');
      window.setTimeout(() => {
        setCognitiveState('idle');
        engineRef.current?.setCognitiveState('idle');
      }, 1800);
      return;
    }

    setMicActive(true);
    setCognitiveState('listening');
    engineRef.current?.setCognitiveState('listening');
    soundEngine.playPulse(392, 0.18, 0.04);

    const srOk = voiceManager.startListening({
      onInterim: (txt) => setInterimTranscript(txt),
      onFinal: (txt) => {
        setInterimTranscript('');
        submitCommand(txt);
      },
      onError: (msg) => {
        showNotice(msg);
      },
      onListeningChange: (active) => {
        if (!active && !voiceManager.isSpeechRecognitionSupported()) {
          // Audio-reactive mic mode without Web Speech API
        }
      },
    });

    if (!srOk) {
      showNotice(
        'Live audio reactivity enabled. Speech-to-text is unsupported in this browser—use text input to converse.'
      );
    }
  }, [micActive, showNotice, submitCommand]);

  // Optional MediaPipe Hand Tracking toggle
  const toggleHandTracking = useCallback(async () => {
    if (settings.handTrackingEnabled) {
      handTrackerRef.current?.stop();
      handTrackerRef.current = null;
      setHandGesture('none');
      setSettings((prev) => ({ ...prev, handTrackingEnabled: false }));
      engineRef.current?.setPaused(false);
      return;
    }

    if (!handVideoRef.current) return;
    setSettings((prev) => ({ ...prev, handTrackingEnabled: true }));

    const tracker = new HandTracker();
    handTrackerRef.current = tracker;
    const ok = await tracker.start(handVideoRef.current, {
      onGestureState: (g) => setHandGesture(g),
      onAwakenGesture: () => {
        if (visualModeRef.current === 'orb') {
          triggerAwakenSequence();
        }
      },
      onRotateZoom: (rotX, rotY, zoomDelta) => {
        engineRef.current?.applyHandGesture({
          rotateXDelta: rotX,
          rotateYDelta: rotY,
          zoomDelta,
        });
      },
      onPauseToggle: (paused) => {
        engineRef.current?.setPaused(paused);
        showNotice(paused ? 'Animation paused via fist gesture' : 'Animation resumed');
      },
      onError: (msg) => {
        showNotice(msg);
        setSettings((prev) => ({ ...prev, handTrackingEnabled: false }));
      },
    });

    if (!ok) {
      handTrackerRef.current = null;
      setSettings((prev) => ({ ...prev, handTrackingEnabled: false }));
    }
  }, [settings.handTrackingEnabled, showNotice, triggerAwakenSequence]);

  useEffect(() => {
    return () => {
      handTrackerRef.current?.stop();
      voiceManager.stopListening();
      soundEngine.stopMicrophone();
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const val = inputText;
    setInputText('');
    submitCommand(val);
  };

  const stateMeta = STATE_META[cognitiveState];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#030408] text-slate-100 select-none">
      {/* Dedicated WebGL 3D Viewport Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 z-0 cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D neural consciousness canvas"
      />

      {/* Floating Animated Math & Physics Equations Canvas Overlay in Quantum Mode */}
      <QuantumEquationsOverlay
        active={visualMode === 'quantum'}
        reducedMotion={settings.reducedMotion}
      />

      {/* Graceful WebGL Fallback Backdrop */}
      {webglError && (
        <div className="fixed inset-0 z-5 flex items-center justify-center pointer-events-none px-6">
          <div className="max-w-md rounded-xl bg-[#070b14]/95 border border-orange-400/30 p-5 text-center space-y-2 pointer-events-auto">
            <AlertTriangle className="w-6 h-6 text-orange-400 mx-auto" />
            <p className="text-sm text-slate-200">{webglError}</p>
          </div>
        </div>
      )}

      {/* Top Navigation & Mode Bar (3-Zone Contract) */}
      <header className="fixed top-0 inset-x-0 z-20 flex items-center justify-between gap-6 px-4 sm:px-6 h-14 bg-[#030408]/75 border-b border-white/8">
        {/* Zone 1: Brand + Cognitive State */}
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-[var(--font-display)] text-base sm:text-lg font-semibold tracking-[0.18em] text-slate-50 whitespace-nowrap shrink-0">
            NEXUS
          </span>
          <span className="text-white/20" aria-hidden="true">
            /
          </span>
          <div
            className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0"
            aria-live="polite"
          >
            {renderStateIcon(cognitiveState)}
            <span className={stateMeta.colorClass}>{stateMeta.label}</span>
          </div>
        </div>

        {/* Zone 2: Interaction Visual Modes */}
        <nav
          aria-label="Visual formation modes"
          className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/8"
        >
          {MODES.map((m) => {
            const active = visualMode === m.id;
            const activeClass =
              m.id === 'quantum'
                ? 'bg-red-500/18 text-red-200 border border-red-400/40'
                : m.id === 'consciousness'
                  ? 'bg-rose-950/70 text-rose-200 border border-rose-500/40'
                  : m.id === 'neural'
                    ? 'bg-violet-500/18 text-violet-200 border border-violet-400/40'
                    : 'bg-emerald-400/16 text-emerald-200 border border-emerald-400/35';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeSwitch(m.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? activeClass
                    : 'text-slate-400 hover:text-slate-100 border border-transparent'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Utility Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              setSettings((p) => ({
                ...p,
                quantumSketches: !p.quantumSketches,
              }))
            }
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              settings.quantumSketches
                ? 'bg-emerald-400/16 border-emerald-400/40 text-emerald-200'
                : 'bg-white/[0.03] border-white/8 text-slate-400 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Toggle Quantum Style Sketches"
            aria-label="Toggle quantum style sketches"
          >
            <Atom className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setPlatesOpen((p) => !p)}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              platesOpen
                ? 'bg-red-500/20 border-red-400/45 text-red-200'
                : 'bg-white/[0.03] border-white/8 text-slate-300 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Quantum Concept Plates"
            aria-label="Open quantum concept plates"
          >
            <Images className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setHistoryOpen((p) => !p)}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              historyOpen
                ? 'bg-violet-500/20 border-violet-400/40 text-violet-200'
                : 'bg-white/[0.03] border-white/8 text-slate-300 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Conversation History"
            aria-label="Toggle conversation history"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              setSettings((p) => ({ ...p, soundEnabled: !p.soundEnabled }))
            }
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              settings.soundEnabled
                ? 'bg-white/[0.03] border-white/8 text-slate-300 hover:text-white hover:bg-white/[0.08]'
                : 'bg-white/[0.02] border-white/8 text-slate-500 hover:text-slate-300'
            }`}
            title={settings.soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            aria-label={settings.soundEnabled ? 'Mute audio' : 'Unmute audio'}
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleHandTracking}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              settings.handTrackingEnabled
                ? 'bg-emerald-400/18 border-emerald-400/45 text-emerald-200'
                : 'bg-white/[0.03] border-white/8 text-slate-300 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Webcam Hand Tracking (MediaPipe)"
            aria-label="Toggle webcam hand tracking"
          >
            <Hand className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex p-2 rounded-lg bg-white/[0.03] border border-white/8 text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg bg-white/[0.03] border border-white/8 text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Compact Mode Strip */}
      <div className="md:hidden fixed top-16 inset-x-4 z-20 flex items-center justify-center">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#070b14]/90 border border-white/10 overflow-x-auto max-w-full">
          {MODES.map((m) => {
            const active = visualMode === m.id;
            const mobileActive =
              m.id === 'quantum'
                ? 'bg-red-500/20 text-red-200'
                : m.id === 'consciousness'
                  ? 'bg-rose-950/75 text-rose-200'
                  : m.id === 'neural'
                    ? 'bg-violet-500/20 text-violet-200'
                    : 'bg-emerald-400/20 text-emerald-200';
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleModeSwitch(m.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? mobileActive : 'text-slate-400'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opening Dormant Orb Invitation */}
      {visualMode === 'orb' && !hasAwakened && messages.length === 0 && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-15 flex flex-col items-center gap-3 text-center pointer-events-none">
          <p className="text-xs sm:text-sm tracking-wide text-slate-300/90">
            Click the energy orb or say <span className="text-emerald-300 font-medium">Awaken</span>
          </p>
          <button
            type="button"
            onClick={triggerAwakenSequence}
            className="pointer-events-auto px-5 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase bg-emerald-400/15 hover:bg-emerald-400/25 text-emerald-200 border border-emerald-400/40 transition-colors cursor-pointer"
          >
            Awaken
          </button>
        </div>
      )}

      {/* Discreet Toast Notice */}
      {noticeText && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-[#080d19]/95 border border-white/12 text-xs text-slate-200 shadow-lg">
          {noticeText}
        </div>
      )}

      {/* Optional MediaPipe Hand Tracking Preview */}
      <div
        className={`fixed bottom-24 left-4 z-20 rounded-lg overflow-hidden border border-white/12 bg-[#070b14]/95 transition-opacity ${
          settings.handTrackingEnabled
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <video
          ref={handVideoRef}
          muted
          playsInline
          className="w-36 h-24 object-cover -scale-x-100 block"
        />
        <div className="px-2.5 py-1 text-[11px] text-emerald-200 border-t border-white/10">
          {GESTURE_LABELS[handGesture]}
        </div>
      </div>

      {/* Slide-Over Conversation History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        messages={messages}
        onClose={() => setHistoryOpen(false)}
        onClear={() => {
          setMessages([]);
          setLatestReply(null);
        }}
        onSelectPrompt={(txt) => {
          setHistoryOpen(false);
          submitCommand(txt);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        voices={voices}
        onClose={() => setSettingsOpen(false)}
        onUpdate={(partial) => setSettings((p) => ({ ...p, ...partial }))}
        onResetExperience={handleResetExperience}
      />

      {/* Quantum Concept Plates Modal */}
      <QuantumPlatesModal
        open={platesOpen}
        onClose={() => setPlatesOpen(false)}
        onActivateQuantum={(plate) => {
          if (!settings.quantumSketches) {
            setSettings((p) => ({ ...p, quantumSketches: true }));
          }
          handleModeSwitch('quantum');
          showNotice(`Quantum manifold projected: ${plate.title}`);
        }}
      />

      {/* Collapsible Bottom Command Dock */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(820px,94vw)] transition-transform duration-300 ease-out ${
          dockCollapsed ? 'translate-y-[calc(100%-26px)]' : 'translate-y-0'
        }`}
      >
        {/* Cinema / Collapse Toggle */}
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#070b14]/90 border border-white/10 text-[11px] text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            title="Toggle controls (Shortcut: H)"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        {/* Latest AI Response Caption */}
        {!dockCollapsed && latestReply && (
          <div
            className={`mb-2.5 rounded-xl px-4 py-3 border shadow-xl ${
              latestReply.isError
                ? 'bg-[#180a0a]/95 border-orange-400/35'
                : 'bg-[#070b14]/92 border-white/12'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <p className="text-sm leading-relaxed text-slate-100 select-text">
                  {latestReply.text}
                </p>
                {latestReply.regions && latestReply.regions.length > 0 && (
                  <p className="text-[11px] text-emerald-300/80">
                    Active regions:{' '}
                    {latestReply.regions
                      .map((r) => REGION_NAMES[r] ?? r)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLatestReply(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 shrink-0 cursor-pointer"
                aria-label="Dismiss response"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Command Bar */}
        <div className="rounded-xl bg-[#070b14]/92 border border-white/12 shadow-2xl px-3 py-2.5 space-y-2">
          {/* Live Transcription / Waveform Row */}
          {(micActive || isSpeaking || interimTranscript) && (
            <div className="flex items-center justify-between gap-3 px-1 pb-1 border-b border-white/8">
              <div className="flex items-center gap-3 min-w-0">
                <AudioWaveform
                  bins={audioBins}
                  state={cognitiveState}
                  active={micActive || isSpeaking}
                />
                <span className="text-xs text-slate-300 truncate">
                  {interimTranscript
                    ? interimTranscript
                    : isSpeaking
                      ? 'NEXUS speaking...'
                      : 'Listening for voice command...'}
                </span>
              </div>
              {isSpeaking && (
                <button
                  type="button"
                  onClick={() => {
                    voiceManager.cancelSpeech();
                    setIsSpeaking(false);
                    setCognitiveState(micActive ? 'listening' : 'idle');
                    engineRef.current?.setCognitiveState(
                      micActive ? 'listening' : 'idle'
                    );
                  }}
                  className="text-[11px] text-slate-400 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Stop voice
                </button>
              )}
            </div>
          )}

          {/* Input & Action Buttons */}
          <form
            onSubmit={handleFormSubmit}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleMicrophone}
              className={`p-2.5 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                micActive
                  ? 'bg-emerald-400/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }`}
              title={micActive ? 'Mute Microphone' : 'Activate Voice Input'}
              aria-label={micActive ? 'Mute microphone' : 'Activate voice input'}
            >
              {micActive ? (
                <Mic className="w-4 h-4" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder='Ask NEXUS anything, or say "Awaken" / "Galaxy mode"...'
              className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />

            <button
              type="button"
              onClick={handleResetExperience}
              className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer"
              title="Reset Experience"
              aria-label="Reset experience"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={!inputText.trim() || cognitiveState === 'thinking'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Transmit</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
