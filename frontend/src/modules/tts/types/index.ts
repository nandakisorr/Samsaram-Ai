export interface TtsConfig {
  text: string;
  emotion: string;
  voice?: string;
  speed?: number;
}

export interface TtsState {
  isPlaying: boolean;
  isGenerating: boolean;
  error: string | null;
  audioUrl: string | null;
  config: TtsConfig;
}

export const EMOTION_OPTIONS = [
  { value: 'neutral', label: 'Neutral', voice: 'nova', speed: 1.0 },
  { value: 'cheerful', label: 'Cheerful', voice: 'nova', speed: 1.1 },
  { value: 'calm', label: 'Calm', voice: 'fable', speed: 0.95 },
  { value: 'sad', label: 'Sad', voice: 'echo', speed: 0.9 },
  { value: 'angry', label: 'Angry', voice: 'echo', speed: 1.2 },
  { value: 'excited', label: 'Excited', voice: 'shimmer', speed: 1.15 },
  { value: 'friendly', label: 'Friendly', voice: 'fable', speed: 1.05 },
];

export const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'echo', label: 'Echo (Deep)' },
  { value: 'fable', label: 'Fable (Warm)' },
  { value: 'onyx', label: 'Onyx (Deep)' },
  { value: 'nova', label: 'Nova (Friendly)' },
  { value: 'shimmer', label: 'Shimmer (Bright)' },
];
