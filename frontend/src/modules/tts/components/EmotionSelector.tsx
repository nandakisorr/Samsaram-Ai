import { EMOTION_OPTIONS } from '../types';
import styles from './EmotionSelector.module.css';

interface EmotionSelectorProps {
  value: string;
  onChange: (emotion: string) => void;
  disabled?: boolean;
}

export function EmotionSelector({ value, onChange, disabled = false }: EmotionSelectorProps) {
  return (
    <div className={styles.container}>
      <label className={styles.label}>Emotion:</label>
      <div className={styles.options}>
        {EMOTION_OPTIONS.map((emotion) => (
          <button
            key={emotion.value}
            className={`${styles.option} ${value === emotion.value ? styles.active : ''}`}
            onClick={() => onChange(emotion.value)}
            disabled={disabled}
            title={`${emotion.label} (${emotion.voice}, ${emotion.speed}x speed)`}
          >
            {emotion.label}
          </button>
        ))}
      </div>
    </div>
  );
}
