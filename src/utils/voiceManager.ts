// Web Speech API Recognition & Text-to-Speech synthesis manager

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface VoiceCallbacks {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (err: string) => void;
  onListeningChange?: (listening: boolean) => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
}

class VoiceManager {
  private recognition: SpeechRecognitionLike | null = null;
  private isListening = false;
  private callbacks: VoiceCallbacks = {};

  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  public isTTSSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.isTTSSupported()) return [];
    return window.speechSynthesis.getVoices();
  }

  public startListening(callbacks: VoiceCallbacks): boolean {
    this.callbacks = callbacks;
    if (!this.isSpeechRecognitionSupported()) {
      callbacks.onError?.(
        'Speech recognition is not supported in this browser. You can still type commands or use voice reactivity.'
      );
      return false;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return false;

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      let interim = '';
      let finalStr = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) {
          finalStr += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim.trim()) {
        this.callbacks.onInterim?.(interim.trim());
      }
      if (finalStr.trim()) {
        this.callbacks.onInterim?.('');
        this.callbacks.onFinal?.(finalStr.trim());
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      this.isListening = false;
      this.callbacks.onListeningChange?.(false);
      this.callbacks.onError?.(
        ev.error === 'not-allowed'
          ? 'Microphone permission was denied.'
          : `Voice input error: ${ev.error}`
      );
    };

    rec.onend = () => {
      if (this.isListening) {
        try {
          rec.start();
        } catch {
          this.isListening = false;
          this.callbacks.onListeningChange?.(false);
        }
      } else {
        this.callbacks.onListeningChange?.(false);
      }
    };

    try {
      rec.start();
      this.recognition = rec;
      this.isListening = true;
      this.callbacks.onListeningChange?.(true);
      return true;
    } catch {
      this.isListening = false;
      this.callbacks.onListeningChange?.(false);
      return false;
    }
  }

  public stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.callbacks.onListeningChange?.(false);
  }

  public speak(
    text: string,
    voiceURI?: string,
    callbacks?: Pick<VoiceCallbacks, 'onSpeakStart' | 'onSpeakEnd'>
  ) {
    if (!this.isTTSSupported() || !text.trim()) {
      callbacks?.onSpeakEnd?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    if (voiceURI) {
      const match = voices.find((v) => v.voiceURI === voiceURI);
      if (match) utter.voice = match;
    } else {
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            /natural|neural|google|samantha|daniel/i.test(v.name)
        ) || voices.find((v) => v.lang.startsWith('en'));
      if (preferred) utter.voice = preferred;
    }

    utter.rate = 1.0;
    utter.pitch = 0.96;

    utter.onstart = () => callbacks?.onSpeakStart?.();
    utter.onend = () => callbacks?.onSpeakEnd?.();
    utter.onerror = () => callbacks?.onSpeakEnd?.();

    window.speechSynthesis.speak(utter);
  }

  public cancelSpeech() {
    if (this.isTTSSupported()) {
      window.speechSynthesis.cancel();
    }
  }
}

export const voiceManager = new VoiceManager();
