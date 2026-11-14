export type VisualMode =
  | 'orb'
  | 'galaxy'
  | 'brain'
  | 'neural'
  | 'consciousness'
  | 'quantum';

export type CognitiveState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'error'
  | 'success';

export type BrainRegion =
  | 'prefrontal'
  | 'temporal'
  | 'parietal'
  | 'occipital'
  | 'cerebellum';

export type GraphicsQuality = 'high' | 'balanced' | 'performance';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  regions?: BrainRegion[];
  isError?: boolean;
}

export interface NexusSettings {
  quality: GraphicsQuality;
  reducedMotion: boolean;
  soundEnabled: boolean;
  autoSpeak: boolean;
  selectedVoiceURI: string;
  handTrackingEnabled: boolean;
  quantumSketches: boolean;
}

export interface ApiChatResponse {
  reply: string;
  activatedRegions: BrainRegion[];
  suggestedMode: VisualMode | 'awaken' | 'reset' | null;
  sentiment: 'neutral' | 'success' | 'insight';
}
