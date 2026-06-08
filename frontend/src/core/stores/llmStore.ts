import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Provider options (local CLI)
export const PROVIDER_OPTIONS = [
  { value: 'ollama', label: 'Ollama (Local API)' },
  { value: 'kilo_code', label: 'Kilo Code (CLI)' },
] as const;

export type Provider = typeof PROVIDER_OPTIONS[number]['value'];

// Recommended models for Ollama (local, pulled via `ollama pull`)
const OLLAMA_MODELS = [
  { value: 'qwen3:8b', label: 'Qwen3 8B (Multilingual, ~6GB RAM)' },
  { value: 'qwen3:14b', label: 'Qwen3 14B (Better quality, ~12GB RAM)' },
  { value: 'llama3.1:8b', label: 'Llama 3.1 8B (~6GB RAM)' },
  { value: 'mistral:7b', label: 'Mistral 7B (~6GB RAM)' },
  { value: 'deepseek-coder:7b', label: 'DeepSeek Coder 7B (Code-focused)' },
  { value: 'phi4:14b', label: 'Phi-4 14B (Microsoft, ~9GB RAM)' },
];

// Kilo models placeholder — will be populated by diagnostics API at runtime
const KILO_FREE_MODELS: { value: string; label: string }[] = [];

export const MODEL_OPTIONS: Record<Provider, typeof OLLAMA_MODELS> = {
  ollama: OLLAMA_MODELS,
  kilo_code: KILO_FREE_MODELS,
};

// Default model per provider
export const DEFAULT_MODEL: Record<Provider, string> = {
  ollama: 'qwen3:8b',
  kilo_code: 'kilo/kilo-auto/free',
};

interface LLMState {
  provider: Provider;
  model: string;
  kiloModels: { value: string; label: string }[];
  setProvider: (provider: Provider) => void;
  setModel: (model: string) => void;
  setLLM: (provider: Provider, model: string) => void;
  getModelsForProvider: (provider: Provider) => { value: string; label: string }[];
  refreshKiloModels: (freeOnly?: boolean) => Promise<void>;
}

export const useLLMStore = create<LLMState>()(
  persist(
    (set, get) => ({
      provider: 'kilo_code',
      model: DEFAULT_MODEL.kilo_code,
      kiloModels: KILO_FREE_MODELS,
      setProvider: (provider) => {
        const newModel = DEFAULT_MODEL[provider];
        set({ provider, model: newModel });
      },
      setModel: (model) => set({ model }),
      setLLM: (provider, model) => set({ provider, model }),
      getModelsForProvider: (provider) => {
        if (provider === 'kilo_code') {
          return get().kiloModels;
        }
        return MODEL_OPTIONS[provider] as { value: string; label: string }[];
      },
      refreshKiloModels: async (freeOnly = false) => {
        try {
          const resp = await fetch(`/api/v1/chat/diagnostics/kilo_models?free_only=${freeOnly ? 'true' : 'false'}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!resp.ok) {
            console.warn('Failed to fetch kilo models', resp.status);
            return;
          }
          const data = await resp.json();
          const models: string[] = data.models || [];
          // Enforce only kilo-auto variants and free models
          const filtered = models.filter((m) => {
            if (!m || typeof m !== 'string') return false;
            const low = m.toLowerCase();
            return m.startsWith('kilo/kilo-auto/') || low.includes('free');
          });
          // Remove the 'kilo/' provider prefix and provider company segment from labels while keeping values intact
          const mapped = filtered.map((m) => {
            const noPrefix = m.replace(/^kilo\//, '');
            const parts = noPrefix.split('/');
            // Keep kilo-auto family intact (e.g. kilo-auto/free). For others, drop the provider segment and show only the model part(s).
            let label = '';
            if (parts[0] === 'kilo-auto') {
              label = parts.join('/');
            } else if (parts.length > 1) {
              label = parts.slice(1).join('/');
            } else {
              label = parts[0];
            }
            // If the label is just 'free', prefix with the provider name (e.g. 'openrouter free') and replace slashes with spaces for readability
            if (label === 'free') {
              label = `${parts[0]} ${label}`;
            }
            label = label.replace(/\//g, ' ');
            return { value: m, label };
          });
          set({ kiloModels: mapped });

          // If current provider is kilo_code and selected model is not in the new list, pick the first allowed
          const state = get();
          if (state.provider === 'kilo_code') {
            const currentModel = state.model;
            const exists = mapped.some((x) => x.value === currentModel);
            if (!exists && mapped.length > 0) {
              set({ model: mapped[0].value });
            }
          }
        } catch (err) {
          console.warn('Error refreshing kilo models', err);
        }
      },
    }),
    {
      name: 'chatbot-llm-settings',
    }
  )
);

// Ensure we sanitize / refresh persisted kiloModels on page load
if (typeof window !== 'undefined') {
  // run after current tick to allow store to initialize
  setTimeout(() => {
    try {
      const state = useLLMStore.getState();
      // sanitize existing persisted models to allowed set
      const allowed = (state.kiloModels || []).filter((m) => m && (m.value?.startsWith('kilo/kilo-auto/') || m.value?.toLowerCase().includes('free')));
      if (allowed.length !== (state.kiloModels || []).length) {
        useLLMStore.setState({ kiloModels: allowed });
      }
      // trigger a background refresh to ensure latest list
      state.refreshKiloModels(false).catch(() => {});
    } catch (e) {
      // ignore
    }
  }, 0);
}

