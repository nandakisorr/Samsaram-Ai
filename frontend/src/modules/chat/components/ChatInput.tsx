import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Mic, MicOff, Loader2, Square } from 'lucide-react';
import { sttService } from '../services/sttService';
import { useLLMStore, PROVIDER_OPTIONS, MODEL_OPTIONS } from '@/core/stores/llmStore';
import type { Provider } from '@/core/stores/llmStore';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onStop?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, isGenerating, onStop }) => {
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
   const audioChunksRef = useRef<Blob[]>([]);
   const streamRef = useRef<MediaStream | null>(null);
   const mimeTypeRef = useRef<string>('');

  // LLM provider/store
  const llmStore = useLLMStore();
  const provider = llmStore.provider;
  const model = llmStore.model;
  const setProvider = llmStore.setProvider;
  const setModel = llmStore.setModel;
  // When mounted, refresh Kilo models to include full list
  useEffect(() => {
    llmStore.refreshKiloModels(false).catch(() => {});
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const recognitionRef = useRef<any>(null);
  const stableTranscriptRef = useRef<string>('');
  const isRecordingRef = useRef<boolean>(false);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      return;
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      isRecordingRef.current = true;
      stableTranscriptRef.current = inputValue || '';
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          let interim = '';
          let finalText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const t = res[0]?.transcript || '';
            if (res.isFinal) {
              finalText += t;
            } else {
              interim += t;
            }
          }
          if (finalText) {
            if (stableTranscriptRef.current && !stableTranscriptRef.current.endsWith(' ')) {
              stableTranscriptRef.current += ' ';
            }
            stableTranscriptRef.current += finalText;
          }
          const combined = (stableTranscriptRef.current || '') + (interim ? (stableTranscriptRef.current && !stableTranscriptRef.current.endsWith(' ') ? ' ' : '') + interim : '');
          setInputValue(combined);
        };
        recognition.onerror = (ev: any) => {
          setError(ev.error || 'Speech recognition error');
        };
        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          recognition.start();
          setIsRecording(true);
          return;
        } catch (err: any) {}
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let chosenMimeType = '';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/wav'];
        for (const type of preferred) {
          try {
            if (MediaRecorder.isTypeSupported(type)) {
              chosenMimeType = type;
              break;
            }
          } catch {}
        }
      }
      mimeTypeRef.current = chosenMimeType;

      const options = chosenMimeType ? { mimeType: chosenMimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      mimeTypeRef.current = mediaRecorder.mimeType || chosenMimeType || 'audio/webm';
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
        audioChunksRef.current = [];
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {}
        setIsTranscribing(true);
        try {
          const text = await sttService.transcribe(audioBlob, 'auto');
          setInputValue((prev) => (prev ? prev + ' ' : '') + text);
        } catch (err: any) {
          setError(err.message || 'Transcription failed');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setError(`Microphone error: ${err.message}`);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [inputValue]);

  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled && !isTranscribing) {
      onSend(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const getMicButtonStyle = (): React.CSSProperties => {
    const base = {
      width: '48px',
      height: '48px',
      border: 'none',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'background 0.2s',
      flexShrink: 0,
      color: 'white',
      opacity: 1,
    };
    if (isRecording) {
      return { ...base, background: '#ef4444' };
    } else if (isTranscribing) {
      return { ...base, background: '#eab308', cursor: 'wait' };
    } else {
      return { ...base, background: '#22c55e' };
    }
  };

  const getSendButtonStyle = (): React.CSSProperties => {
    const base = {
      width: '48px',
      height: '48px',
      border: 'none',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer' as const,
      transition: 'background 0.2s',
      flexShrink: 0,
      color: 'white',
    };
    if (!inputValue.trim() || disabled || isTranscribing) {
      return { ...base, background: '#6b7280', cursor: 'not-allowed', opacity: 0.4 };
    } else {
      return { ...base, background: '#3b82f6' };
    }
  };

  const getStopButtonStyle = (): React.CSSProperties => ({
    width: '48px',
    height: '48px',
    border: 'none',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s',
    flexShrink: 0,
    color: 'white',
    background: '#ef4444',
  });

  // Container style to replace Tailwind flex classes
  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
  };

  const textareaWrapperStyle: React.CSSProperties = {
    flex: 1,
    position: 'relative',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    resize: 'none',
    background: 'transparent',
    color: 'white',
    border: 'none',
    outline: 'none',
    padding: '12px 16px',
    borderRadius: '12px',
    fontFamily: 'inherit',
    fontSize: '1rem',
    lineHeight: '1.5',
    minHeight: '44px',
    maxHeight: '150px',
    overflowY: 'auto' as const,
  };

  const formStyle: React.CSSProperties = {
    padding: '12px 24px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  };

   return (
     <motion.form
       onSubmit={handleSubmit}
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       className={styles.container}
     >
       <div className={styles.inputWrapper}>
          {/* LLM Provider & Model Selectors */}
          <div className={styles.controls}>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              style={{ width: '130px' }}
              title="Select AI provider"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

             <select
               value={model}
               onChange={(e) => setModel(e.target.value)}
               style={{ width: '180px' }}
               title="Select model"
             >
                {(MODEL_OPTIONS[provider as keyof typeof MODEL_OPTIONS] || MODEL_OPTIONS['kilo_code'] || []).map((opt) => (
                 <option key={opt.value} value={opt.value}>
                   {opt.label}
                 </option>
               ))}
             </select>
          </div>

         <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isGenerating ? "AI is responding..." : "Type a message or use voice input..."}
            disabled={disabled || isTranscribing || isGenerating}
            rows={1}
            className={styles.input}
          />
          {error && (
            <div style={{
              position: 'absolute',
              bottom: '-20px',
              left: 0,
              fontSize: '12px',
              color: '#fca5a5',
              background: 'rgba(0,0,0,0.8)',
              padding: '4px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
            }}>
              {error}
            </div>
          )}
        </div>

        {isGenerating ? (
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            className={styles.stopBtn}
            title="Stop generation"
          >
            <Square size={20} />
          </motion.button>
        ) : (
          <>
            <motion.button
              type="button"
              whileHover={{ scale: 1 }}
              whileTap={{ scale: isRecording || isTranscribing ? 1 : 0.95 }}
              onClick={handleRecordToggle}
              disabled={disabled || isTranscribing}
              style={{
                width: '48px',
                height: '48px',
                border: 'none',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isRecording || isTranscribing || disabled ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
                color: 'white',
                opacity: (disabled || isTranscribing) && !isRecording ? 0.5 : 1,
                background: isRecording
                  ? '#ef4444'
                  : isTranscribing
                  ? '#eab308'
                  : '#22c55e',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                outline: 'none',
              }}
              title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start voice input'}
            >
              {isTranscribing ? (
                <Loader2 size={20} />
              ) : isRecording ? (
                <MicOff size={20} />
              ) : (
                <Mic size={20} />
              )}
            </motion.button>

            <motion.button
              type="submit"
              disabled={!inputValue.trim() || disabled || isTranscribing}
              whileHover={{ scale: inputValue.trim() && !disabled && !isTranscribing ? 1.05 : 1 }}
              whileTap={{ scale: inputValue.trim() && !disabled && !isTranscribing ? 0.95 : 1 }}
              className={`${styles.sendBtn} ${!inputValue.trim() || disabled || isTranscribing ? styles.disabled : ''}`}
            >
              <Send size={20} />
            </motion.button>
          </>
        )}
      </div>

      {error && (
        <div className={styles.footer}>
          <span className={styles.hint}>{error}</span>
        </div>
      )}
    </motion.form>
  );
};
