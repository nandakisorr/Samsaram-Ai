// Global TypeScript types shared across modules

export interface User {
  username: string;
  sub?: string;  // subject (user ID) from JWT
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

export interface ChatRequest {
  session_id: number;
  message: string;
  tts?: boolean;
  emotion?: string;
  language?: string;
  tts_engine?: 'piper' | 'xtts';  // TTS backend selection
  voice?: string;                 // voice model name or friendly alias
  speaker_wav?: string;           // optional path to custom voice (XTTS cloning)
  provider?: 'ollama' | 'kilo_code';  // LLM provider selection (ollama=local API, kilo_code=local CLI)
  model?: string;                 // specific model name
}

export interface ChatResponseText {
  text: string;  // streaming returns plain text
}

export interface ChatResponseWithTTS {
  text: string;
  audio: string;  // base64 MP3
  format: string;
  voice: string;
  emotion: string;
  speed: number;
}

// TTS types
export interface TtsRequest {
  text: string;
  emotion: string;
  voice?: string;
  speed?: number;
  language?: string;
  tts_engine?: string;
  speaker_wav?: string;
}

export interface TtsResponse {
  audio: string;  // base64 MP3
  format: string;
  voice: string;
  emotion: string;
  speed: number;
  language: string;
  engine: string;
}

// Session/History types
export interface SessionSummary {
  session_id: number;
  started_at: string;
  message_count: number;
  messages: ChatMessage[];
}

export interface SessionDetail {
  session_id: number;
  started_at: string;
  messages: ChatMessage[];
}

export interface NewSessionResponse {
  session_id: number;
  started_at: string;
}

export interface DeleteResponse {
  detail: string;
}

// Auth types (from backend schemas)
export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface UserResponse {
  username: string;
  email?: string;
  date_of_birth?: string;
  created_at?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  date_of_birth?: string;
  confirm_password?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
  confirm_password: string;
}

export interface ResetPasswordResponse {
  message: string;
  success?: boolean;
}

export interface PasswordResetTokenResponse {
  valid: boolean;
  message: string;
}

// User (from JWT)
export interface User {
  username: string;
  sub?: string;  // subject (user ID) from JWT
}

// STT (Speech-to-Text) types
export interface SttTranscribeResponse {
   text: string;
   language: string;
   backend: string;
   success: boolean;
 }

 export type SttBackend = 'faster_whisper' | 'vosk' | 'ollama' | 'openai';

 export interface SttHealthResponse {
   status: 'ok' | 'error';
   backend: SttBackend;
   model?: string;
   error?: string;
   [key: string]: any;
 }

 export interface SttAvailableBackendsResponse {
   backends: SttHealthResponse[];
 }
