import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'system' | 'light' | 'dark';

interface GradientColors {
  color1: string;
  color2: string;
  color3: string;
  color4: string;
}

interface ThemeConfig {
  mode: ThemeMode;
  gradientColors: GradientColors;
  animationDuration: number;
  blurIntensity: number;
  glassOpacity: number;
  bubbleRadius: number;
}

interface ThemeState {
  theme: ThemeConfig;
  setTheme: (theme: Partial<ThemeConfig>) => void;
  resetToDefault: () => void;
}

// Default theme matching the current ChatPage gradient
const defaultGradientColors: GradientColors = {
  color1: '#0f0c29',
  color2: '#2b6345',
  color3: '#24243e',
  color4: '#0f0c29',
};

// Preset themes
export const THEME_PRESETS = {
  default: {
    mode: 'system' as ThemeMode,
    gradientColors: defaultGradientColors,
    animationDuration: 15,
    blurIntensity: 20,
    glassOpacity: 0.08,
    bubbleRadius: 18,
  },
  ocean: {
    mode: 'dark' as ThemeMode,
    gradientColors: {
      color1: '#0f2027',
      color2: '#203a43',
      color3: '#2c5364',
      color4: '#0f2027',
    },
    animationDuration: 20,
    blurIntensity: 24,
    glassOpacity: 0.1,
    bubbleRadius: 20,
  },
  sunset: {
    mode: 'dark' as ThemeMode,
    gradientColors: {
      color1: '#451a03',
      color2: '#8b3a00',
      color3: '#cc3300',
      color4: '#451a03',
    },
    animationDuration: 12,
    blurIntensity: 18,
    glassOpacity: 0.12,
    bubbleRadius: 16,
  },
  forest: {
    mode: 'dark' as ThemeMode,
    gradientColors: {
      color1: '#0d3b0d',
      color2: '#1a5c1a',
      color3: '#2d4a2d',
      color4: '#0d3b0d',
    },
    animationDuration: 25,
    blurIntensity: 22,
    glassOpacity: 0.09,
    bubbleRadius: 22,
  },
  neon: {
    mode: 'dark' as ThemeMode,
    gradientColors: {
      color1: '#23074d',
      color2: '#cc5333',
      color3: '#4a00e0',
      color4: '#23074d',
    },
    animationDuration: 8,
    blurIntensity: 16,
    glassOpacity: 0.15,
    bubbleRadius: 14,
  },
  midnight: {
    mode: 'dark' as ThemeMode,
    gradientColors: {
      color1: '#000000',
      color2: '#0f0f0f',
      color3: '#1a1a1a',
      color4: '#000000',
    },
    animationDuration: 30,
    blurIntensity: 28,
    glassOpacity: 0.06,
    bubbleRadius: 24,
  },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: {
        mode: 'system',
        gradientColors: defaultGradientColors,
        animationDuration: 15,
        blurIntensity: 20,
        glassOpacity: 0.08,
        bubbleRadius: 18,
      },
      setTheme: (newTheme) => {
        set((state) => ({ theme: { ...state.theme, ...newTheme } }));
      },
      resetToDefault: () => {
        set({ theme: THEME_PRESETS.default });
      },
    }),
    {
      name: 'chatbot-custom-theme',
    }
  )
);
