import { useState, useCallback, useRef, useEffect } from 'react';
import { TtsConfig, TtsState } from '../types';
import ttsService from '../services/ttsService';

export function useTTS() {
  const [state, setState] = useState<TtsState>({
    isPlaying: false,
    isGenerating: false,
    error: null,
    audioUrl: null,
    config: {
      text: '',
      emotion: 'neutral',
      voice: 'nova', // default female voice
    },
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update config
  const updateConfig = useCallback((config: Partial<TtsConfig>) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, ...config },
    }));
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  // Generate TTS audio
  const generate = useCallback(async () => {
    const { text, emotion, voice, speed } = state.config;

    if (!text.trim()) {
      setState(prev => ({
        ...prev,
        error: 'No text provided for TTS',
      }));
      return;
    }

    // Stop any current playback
    stop();

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
    }));

    try {
      const response = await ttsService.generate(text, emotion, voice, speed);

      // Create blob URL
      const audioUrl = ttsService.toBlobUrl(response.audio, response.format);

      setState(prev => ({
        ...prev,
        isGenerating: false,
        audioUrl,
      }));

      return response;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error.detail || error.message || 'TTS generation failed',
      }));
      throw error;
    }
  }, [state.config, stop]);

  // Set audio directly from base64 (for pre-generated TTS)
  const setAudioFromBase64 = useCallback((base64: string, format: string = 'mp3') => {
    const audioUrl = ttsService.toBlobUrl(base64, format);
    setState(prev => ({
      ...prev,
      audioUrl,
      isGenerating: false,
    }));
  }, []);

  // Play audio
  const play = useCallback(async () => {
    if (!state.audioUrl) {
      await generate();
    }

    if (state.audioUrl) {
      // Stop existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(state.audioUrl);

      audio.onended = () => {
        setState(prev => ({ ...prev, isPlaying: false }));
      };

      audio.onerror = () => {
        setState(prev => ({
          ...prev,
          isPlaying: false,
          error: 'Audio playback failed',
        }));
      };

      audioRef.current = audio;
      setState(prev => ({ ...prev, isPlaying: true }));
      await audio.play();
    }
  }, [state.audioUrl, generate]);

  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    stop();
    setState({
      isPlaying: false,
      isGenerating: false,
      error: null,
      audioUrl: null,
      config: {
        text: '',
        emotion: 'neutral',
      },
    });
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return {
    ...state,
    updateConfig,
    generate,
    setAudioFromBase64,
    play,
    stop,
    pause,
    reset,
  };
}

export default useTTS;
