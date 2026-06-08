import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';
import { sttService } from '../services/sttService';
import styles from './MicrophoneButton.module.css';

interface MicrophoneButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({
  onTranscription,
  disabled = false,
  className = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
   const [isTranscribing, setIsTranscribing] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
   const audioChunksRef = useRef<Blob[]>([]);
   const streamRef = useRef<MediaStream | null>(null);
   const mimeTypeRef = useRef<string>('');

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Detect a supported audio MIME type for MediaRecorder
      let chosenMimeType = '';
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
              chosenMimeType = type;
              break;
            }
          } catch {
            // ignore and continue
          }
        }
      }
      mimeTypeRef.current = chosenMimeType;

      const options = chosenMimeType ? { mimeType: chosenMimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      // Store the actual MIME type used by the MediaRecorder (may differ from requested)
      mimeTypeRef.current = mediaRecorder.mimeType || chosenMimeType || 'audio/webm';
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current || 'audio/webm',
        });
        audioChunksRef.current = [];

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        // Transcribe
        setIsTranscribing(true);
        try {
          const text = await sttService.transcribe(audioBlob, 'auto'); // Auto-detect language
          onTranscription(text);
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
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const buttonClass = `
    ${styles.button}
    ${isRecording ? styles.recording : ''}
    ${disabled ? styles.disabled : ''}
    ${className}
  `;

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={disabled || isTranscribing}
      className={buttonClass}
      title={isRecording ? 'Stop recording' : 'Start voice input'}
      aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
    >
      {isTranscribing ? (
        <Loader size={20} className={styles.spinner} />
      ) : isRecording ? (
        <MicOff size={20} />
      ) : (
        <Mic size={20} />
      )}
      <span className={styles.label}>
        {isTranscribing ? 'Transcribing...' : isRecording ? 'Stop' : 'Voice'}
      </span>
      {isRecording && <span className={styles.pulse} />}
      {error && <span className={styles.error}>{error}</span>}
    </button>
  );
};
