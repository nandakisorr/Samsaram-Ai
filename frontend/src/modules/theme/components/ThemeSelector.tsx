import React, { useState, useRef, useEffect } from 'react';
import { useThemeStore, THEME_PRESETS } from '@/core/stores/themeStore';
import styles from './ThemeSelector.module.css';

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme, resetToDefault } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const presetNames = Object.keys(THEME_PRESETS) as (keyof typeof THEME_PRESETS)[];

  const handlePresetSelect = (presetKey: keyof typeof THEME_PRESETS) => {
    setTheme(THEME_PRESETS[presetKey]);
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.trigger} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.icon}>🎀</span>
        <span className={styles.label}>Themes</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h4>Theme Settings</h4>
            <button className={styles.resetBtn} onClick={resetToDefault}>
              Reset Default
            </button>
          </div>

          {/* Mode Selector */}
          <div className={styles.modeSection}>
            <label>Theme Mode</label>
            <div className={styles.modeButtons}>
              <button
                className={`${styles.modeBtn} ${theme.mode === 'system' ? styles.active : ''}`}
                onClick={() => setTheme({ mode: 'system' })}
                title="Follow system preference"
              >
                🖥️ System
              </button>
              <button
                className={`${styles.modeBtn} ${theme.mode === 'light' ? styles.active : ''}`}
                onClick={() => setTheme({ mode: 'light' })}
                title="Light mode"
              >
                ☀️ Light
              </button>
              <button
                className={`${styles.modeBtn} ${theme.mode === 'dark' ? styles.active : ''}`}
                onClick={() => setTheme({ mode: 'dark' })}
                title="Dark mode"
              >
                🌙 Dark
              </button>
            </div>
          </div>

          <div className={styles.divider} />

          {/* Preset Section */}
          <div className={styles.presetSection}>
            <h4>Color Presets</h4>
            <div className={styles.presetGrid}>
              {presetNames.map((name) => (
                <button
                  key={name}
                  className={`${styles.presetCard} ${theme.gradientColors.color1 === THEME_PRESETS[name].gradientColors.color1 ? styles.active : ''}`}
                  onClick={() => handlePresetSelect(name)}
                  style={{
                    background: `linear-gradient(135deg, ${THEME_PRESETS[name].gradientColors.color1}, ${THEME_PRESETS[name].gradientColors.color2 || THEME_PRESETS[name].gradientColors.color1})`,
                  }}
                  title={`Duration: ${THEME_PRESETS[name].animationDuration}s, Blur: ${THEME_PRESETS[name].blurIntensity}px`}
                >
                  <span className={styles.presetName}>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          {/* Customization Section */}
          <div className={styles.customSection}>
            <h4>Customize</h4>

            <div className={styles.sliderGroup}>
              <label>Animation Speed</label>
              <input
                type="range"
                min="5"
                max="60"
                value={theme.animationDuration}
                onChange={(e) => setTheme({ animationDuration: Number(e.target.value) })}
              />
              <span>{theme.animationDuration}s</span>
            </div>

            <div className={styles.sliderGroup}>
              <label>Blur Intensity</label>
              <input
                type="range"
                min="0"
                max="48"
                value={theme.blurIntensity}
                onChange={(e) => setTheme({ blurIntensity: Number(e.target.value) })}
              />
              <span>{theme.blurIntensity}px</span>
            </div>

            <div className={styles.sliderGroup}>
              <label>Glass Opacity</label>
              <input
                type="range"
                min="0.02"
                max="0.3"
                step="0.01"
                value={theme.glassOpacity}
                onChange={(e) => setTheme({ glassOpacity: Number(e.target.value) })}
              />
              <span>{Math.round(theme.glassOpacity * 100)}%</span>
            </div>

            <div className={styles.sliderGroup}>
              <label>Bubble Radius</label>
              <input
                type="range"
                min="12"
                max="30"
                value={theme.bubbleRadius}
                onChange={(e) => setTheme({ bubbleRadius: Number(e.target.value) })}
              />
              <span>{theme.bubbleRadius}px</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
