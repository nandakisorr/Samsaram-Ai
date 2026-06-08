/**
 * STT Service - Speech-to-Text using backend Ollama Whisper
 */

import { SttTranscribeResponse, SttHealthResponse } from '@/core/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const sttService = {
  /**
   * Transcribe an audio blob using the backend Whisper endpoint
   * @param audioBlob - Recorded audio blob (WebM/MP3/WAV)
   * @param language - Language code for transcription, or 'auto' for detection
   * @returns Transcribed text
   */
  async transcribe(audioBlob: Blob, language: string = 'auto'): Promise<string> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated. Please log in.');
    }

    const formData = new FormData();
    // Derive file extension from blob MIME type (e.g., "audio/webm" -> "webm")
    const mimeType = audioBlob.type || 'audio/webm';
    const extension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
    const filename = `recording.${extension}`;
    formData.append('audio', audioBlob, filename);
    formData.append('language', language);

    const response = await fetch(`${API_BASE}/api/v1/stt/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
      const error = await response.json().catch(() => ({ detail: 'Transcription failed' }));
      throw new Error(error.detail || 'Transcription failed');
    }

    const data: SttTranscribeResponse = await response.json();
    return data.text;
  },

  /**
   * Check if Whisper model is available
   */
  async checkHealth(): Promise<SttHealthResponse> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE}/api/v1/stt/health`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to check STT health');
    }

    return response.json();
  },
};

/**
 * Hook-friendly utility: record audio and transcribe
 */
export async function recordAndTranscribe(
  language: string = 'auto',
  onRecordingStart?: () => void,
  onRecordingStop?: () => void,
  onError?: (error: Error) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check for MediaRecorder support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      reject(new Error('Audio recording not supported in this browser. Use Chrome/Firefox/Safari.'));
      return;
    }

    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];
    let mimeType = '';

    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Detect supported MIME type
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
          const preferred = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/wav',
          ];
          for (const type of preferred) {
            try {
              if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                break;
              }
            } catch {
              // ignore
            }
          }
        }

        const options: MediaRecorderOptions = mimeType ? { mimeType } : undefined;
        mediaRecorder = new MediaRecorder(stream, options);
        // Capture the actual mime type used
        mimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: mimeType });
          audioChunks = [];

          try {
            const transcription = await sttService.transcribe(audioBlob, language);
            resolve(transcription);
          } catch (err: any) {
            reject(err);
          } finally {
            // Stop all tracks to release microphone
            stream.getTracks().forEach((track) => track.stop());
          }
        };

        mediaRecorder.start();
        onRecordingStart?.();
      } catch (err: any) {
        reject(new Error(`Microphone access denied: ${err.message}`));
      }
    };

    // Auto-start recording
    startRecording();

    // Auto-stop after 10 seconds
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        onRecordingStop?.();
      }
    }, 10000);
  });
}
