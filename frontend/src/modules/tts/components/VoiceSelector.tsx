import { VOICE_OPTIONS } from '../types';
import styles from './VoiceSelector.module.css';

interface VoiceSelectorProps {
  value: string;
  onChange: (voice: string) => void;
  disabled?: boolean;
}

export function VoiceSelector({ value, onChange, disabled = false }: VoiceSelectorProps) {
  return (
    <div className={styles.container}>
      <label htmlFor="voice-select" className={styles.label}>Voice:</label>
      <select
        id="voice-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={styles.select}
      >
        {VOICE_OPTIONS.map((voice) => (
          <option key={voice.value} value={voice.value}>
            {voice.label}
          </option>
        ))}
      </select>
    </div>
  );
}
