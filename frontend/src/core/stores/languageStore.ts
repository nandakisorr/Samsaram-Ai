import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LanguageState {
  language: string;
  setLanguage: (language: string) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'chatbot-language',
    }
  )
);

// TTS settings store (engine, voice, cloning)
interface TTSSettingsState {
  engine: 'piper' | 'xtts';
  setEngine: (engine: 'piper' | 'xtts') => void;
  voice: string;
  setVoice: (voice: string) => void;
  speakerWav: string | null;  // path to custom voice sample (XTTS cloning)
  setSpeakerWav: (path: string | null) => void;
}

export const useTTSSettingsStore = create<TTSSettingsState>()(
  persist(
    (set) => ({
      engine: 'piper',
      setEngine: (engine) => set({ engine }),
      voice: 'nova',
      setVoice: (voice) => set({ voice }),
      speakerWav: null,
      setSpeakerWav: (path) => set({ speakerWav: path }),
    }),
    {
      name: 'chatbot-tts-settings',
    }
  )
);
