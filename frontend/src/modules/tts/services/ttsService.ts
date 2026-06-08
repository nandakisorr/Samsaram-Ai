import apiClient from '@/core/api/client';
import { TtsRequest, TtsResponse } from '@/core/types';
import { useTTSSettingsStore } from '@/core/stores/languageStore';

export const ttsService = {
  /**
   * Generate TTS audio from text
   * Returns base64 audio string
   */
  async generate(
    text: string,
    emotion: string = 'neutral',
    voice?: string,
    speed?: number,
    language?: string
  ): Promise<TtsResponse> {
    // Get global TTS config from store
    const store = useTTSSettingsStore.getState();
    const payload: TtsRequest = {
      text,
      emotion,
      voice: voice || store.voice,
      speed,
      language: language || 'en',
      tts_engine: store.engine,
      speaker_wav: store.speakerWav || undefined,
    };

    return await apiClient.handleResponse(
       apiClient.post<TtsResponse>('/api/v1/chat/tts', payload)
    );
  },

  /**
   * Generate and play audio directly
   */
  async speak(
    text: string,
    emotion: string = 'neutral',
    voice?: string,
    speed?: number
  ): Promise<void> {
    const response = await this.generate(text, emotion, voice, speed);
    await this.playAudio(response.audio, response.format);
  },

  /**
   * Play base64 audio in browser
   */
  async playAudio(base64Audio: string, format: string = 'mp3'): Promise<void> {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: `audio/${format}` });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const audio = new Audio(url);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Audio playback failed'));
      };

      audio.play().catch(reject);
    });
  },



  /**
   * Convert base64 audio to blob URL (for HTML audio element)
   */
  toBlobUrl(base64Audio: string, format: string = 'mp3'): string {
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: `audio/${format}` });
    return URL.createObjectURL(blob);
  },
};

export default ttsService;
