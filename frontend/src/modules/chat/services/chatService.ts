import apiClient from '@/core/api/client';
import {
  ChatRequest,
  ChatResponseWithTTS,
  ChatResponseText,
  SessionSummary,
  SessionDetail,
  NewSessionResponse,
  DeleteResponse,
} from '@/core/types';
import { useTTSSettingsStore } from '@/core/stores/languageStore';

// Use same base URL as apiClient for direct fetch calls
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Store reference to current AbortController for cancellation
let currentController: AbortController | null = null;

export const chatService = {
  /**
   * Send a message and get streaming text response
   * Returns async generator that yields text chunks
   */
    async *sendMessageStream(
      sessionId: number,
      message: string,
      emotion: string = 'neutral',
      tts: boolean = false,
      language: string = 'en',
      provider: 'kilo_code' | 'ollama' = 'kilo_code',
      model: string | null = null
    ): AsyncGenerator<string, ChatResponseWithTTS | ChatResponseText, unknown> {
     // Get TTS settings from store
     const ttsStore = useTTSSettingsStore.getState();
     const payload: ChatRequest = {
       session_id: sessionId,
       message,
       emotion,
       tts,
       language,
       tts_engine: ttsStore.engine,
       voice: ttsStore.voice,
       speaker_wav: ttsStore.speakerWav || undefined,
       provider,
       model: model || undefined,
     };

     // Cancel any previous request
     if (currentController) {
       currentController.abort();
     }

     const controller = new AbortController();
     currentController = controller;
     const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min

     try {
       // Use streaming endpoint for non-TTS requests
       const endpoint = tts ? '/api/v1/chat/' : '/api/v1/chat/stream';
       console.log('sendMessageStream: endpoint=', endpoint, 'tts=', tts, 'payload:', payload);
       const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
       clearTimeout(timeoutId);

       if (!response.ok) {
         if (response.status === 401) {
           localStorage.removeItem('auth_token');
           localStorage.removeItem('user');
           window.location.href = '/login';
         }
         const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
         throw new Error(error.detail || 'Failed to send message');
       }

       if (tts) {
         // TTS returns JSON with audio
         const data: ChatResponseWithTTS = await response.json();
         return data;
       }

       // Stream plain text response
       const reader = response.body?.getReader();
       if (!reader) {
         throw new Error('Response body is not readable');
       }

       const decoder = new TextDecoder();
       let fullText = '';
       let chunkIndex = 0;

       console.log('sendMessageStream: starting stream reader');
       while (true) {
         const { done, value } = await reader.read();
         if (done) {
           console.log('sendMessageStream: stream complete, total chunks:', chunkIndex);
           break;
         }

         chunkIndex++;
         const chunk = decoder.decode(value, { stream: true });
         console.log(`sendMessageStream: chunk ${chunkIndex}:`, JSON.stringify(chunk));
         fullText += chunk;
         yield chunk;
       }

       // Return final accumulated text
       return { text: fullText };

     } catch (error: any) {
       console.error('sendMessageStream: fetch/stream error', error);
       if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
         throw new Error('Cannot connect to server');
       }
       throw error;
     } finally {
       clearTimeout(timeoutId);
       if (currentController === controller) {
         currentController = null;
       }
     }
   },

  /**
   * Stop the current streaming generation
   */
  stopGeneration() {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }
  },

  /**
   * Create a new chat session
   */
  async createSession(): Promise<NewSessionResponse> {
    return await apiClient.handleResponse(
      apiClient.post<NewSessionResponse>('/api/v1/chat/session')
    );
  },

  /**
   * Get all sessions (history list)
   */
  async getSessions(): Promise<SessionSummary[]> {
    return await apiClient.handleResponse(
      apiClient.get<SessionSummary[]>('/api/v1/chat/history')
    );
  },

  /**
   * Get single session with messages
   */
  async getSession(sessionId: number): Promise<SessionDetail> {
    return await apiClient.handleResponse(
      apiClient.get<SessionDetail>(`/api/v1/chat/history/${sessionId}`)
    );
  },

  /**
   * Stream a past session's messages one by one (for replay).
   * Yields MessageSchema objects as they arrive.
   */
  async *streamSession(
    sessionId: number
  ): AsyncGenerator<{role: string; content: string; time: string | null}, void> {
    const response = await fetch(`${API_BASE}/api/v1/chat/session/${sessionId}/stream`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to stream session: ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const msg = JSON.parse(data);
            yield msg;
          } catch (e) { /* ignore */ }
        }
      }
    }
  },

  /**
   * Delete a session
   */
  async deleteSession(sessionId: number): Promise<DeleteResponse> {
    return await apiClient.handleResponse(
      apiClient.delete<DeleteResponse>(`/api/v1/chat/history/${sessionId}`)
    );
  },

  /**
   * Convenience method: send message and get full response (non-streaming)
   * Useful when TTS is enabled (needs full text)
   */
  async sendMessage(
    sessionId: number,
    message: string,
    emotion: string = 'neutral',
    tts: boolean = false,
    language: string = 'en',
    provider: 'kilo_code' | 'ollama' = 'kilo_code',
    model: string | null = null
  ): Promise<ChatResponseWithTTS | ChatResponseText> {
    const ttsStore = useTTSSettingsStore.getState();
    if (tts) {
      const payload: ChatRequest = {
        session_id: sessionId,
        message,
        emotion,
        tts: true,
        language,
        tts_engine: ttsStore.engine,
        voice: ttsStore.voice,
        speaker_wav: ttsStore.speakerWav || undefined,
        provider,
        model: model || undefined,
      };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      try {
        const response = await fetch(`${API_BASE}/api/v1/chat/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
          const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
          throw new Error(error.detail || 'Failed to send message');
        }
        return await response.json() as ChatResponseWithTTS;
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      let fullText = '';
      for await (const chunk of this.sendMessageStream(sessionId, message, emotion, false, language, provider, model)) {
        fullText += chunk;
      }
      return { text: fullText };
    }
  },
};

export default chatService;
