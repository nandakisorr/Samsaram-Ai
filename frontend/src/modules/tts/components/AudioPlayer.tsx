import { useEffect, useRef } from 'react';
import { useTTS } from '../hooks/useTTS';

interface AudioPlayerProps {
  text: string;
  autoPlay?: boolean;
  onGenerating?: () => void;
  onGenerated?: () => void;
  onError?: (error: string) => void;
  audioData?: string;
}

export function AudioPlayer({
  text,
  autoPlay = false,
  onGenerating,
  onGenerated,
  onError,
  audioData,
}: AudioPlayerProps) {
  const {
    audioUrl,
    isGenerating,
    isPlaying,
    error,
    setAudioFromBase64,
    generate,
    play,
    stop,
  } = useTTS();

  const hasAutoPlayed = useRef(false);

  useEffect(() => {
    if (audioData) {
      setAudioFromBase64(audioData);
    }
  }, [audioData, setAudioFromBase64]);

  useEffect(() => {
    if (autoPlay && audioData && audioUrl && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      play().then(() => {
        onGenerated?.();
      }).catch(() => {});
    }
  }, [audioUrl, autoPlay, audioData, play, onGenerated]);

  useEffect(() => {
    if (autoPlay && text && !isGenerating && !audioData && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      (async () => {
        try {
          onGenerating?.();
          await generate();
          await play();
          onGenerated?.();
        } catch (err) {}
      })();
    }
  }, [autoPlay, text, isGenerating, audioData, generate, play, onGenerating, onGenerated]);

  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const handlePlay = async () => {
    if (isGenerating || isPlaying) return;
    try {
      hasAutoPlayed.current = true;
      if (audioUrl) {
        await play();
        onGenerated?.();
      } else {
        onGenerating?.();
        await generate();
        await play();
        onGenerated?.();
      }
    } catch (err) {}
  };

  const handleStop = () => {
    stop();
  };

  return (
    <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <button
        onClick={isPlaying ? handleStop : handlePlay}
        disabled={isGenerating || (!audioUrl && !text.trim())}
        title={isPlaying ? 'Stop' : 'Play audio'}
        aria-label={isPlaying ? 'Stop playback' : 'Play audio'}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: 'none',
          background: isGenerating ? '#e5e7eb' : isPlaying ? '#ef4444' : '#3b82f6',
          color: 'white',
          cursor: isGenerating || (!audioUrl && !text.trim()) ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
          opacity: isGenerating ? 0.6 : 1,
          padding: 0,
        }}
      >
        {isGenerating ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="8" strokeDasharray="24" strokeDashoffset="8">
              <animate attributeName="stroke-dasharray" values="0 24;12 12;0 24" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </svg>
        ) : isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="3" height="16" rx="1" />
            <rect x="16" y="4" width="3" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4l15 8-15 8z" />
          </svg>
        )}
      </button>
    </div>
  );
}
