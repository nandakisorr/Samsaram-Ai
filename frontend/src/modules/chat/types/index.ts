export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
  audio?: string;  // base64 audio (only for assistant when TTS enabled)
  voice?: string;  // voice used for TTS
  emotion?: string; // emotion used for TTS
}

export interface ChatState {
  messages: ChatMessage[];
  currentSessionId: number | null;
  isLoading: boolean;
  isStreaming: boolean;
  isLoadingSession: boolean;  // true while streaming a past session into view
  error: string | null;
  currentText: string;  // Partial streaming text
}

export interface SendMessageParams {
  sessionId: number;
  message: string;
  emotion?: string;
  tts?: boolean;
  language?: string;
  provider?: string;
  model?: string;
}

export interface ChatResponseWithTTS {
  text: string;
  audio: string;  // base64
  format: string;
  voice: string;
  emotion: string;
  speed: number;
}
