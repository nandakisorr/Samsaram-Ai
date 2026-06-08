import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/providers/AuthProvider';
import { useLanguageStore } from '@/core/stores/languageStore';
import { useTTSSettingsStore } from '@/core/stores/languageStore';  // same file
import { Globe, Volume2 } from 'lucide-react';
import styles from './UserDropdown.module.css';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  // Indian languages
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ml', name: 'മലയാളം' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'gu', name: 'ગુજરાતી' },
  { code: 'mr', name: 'मराठी' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'اردو' },
  { code: 'or', name: 'ଓଡ଼ିଆ' },
  { code: 'si', name: 'සිංහල' },
  { code: 'my', name: 'မြန်မာ' },
  { code: 'ne', name: 'नेपाली' },
  // Other languages
  { code: 'tr', name: 'Türkçe' },
];

interface UserDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  username: string;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({ isOpen, onClose, onToggle, username }) => {
  const { logout } = useAuth();
  const selectedLanguage = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const ttsEngine = useTTSSettingsStore((state) => state.engine);
  const setTTSEngine = useTTSSettingsStore((state) => state.setEngine);
  const ttsVoice = useTTSSettingsStore((state) => state.voice);
  const setTTSVoice = useTTSSettingsStore((state) => state.setVoice);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showLanguages, setShowLanguages] = useState(false);
  const [showTTSSettings, setShowTTSSettings] = useState(false);

  const handleHistoryClick = () => {
    navigate('/history');
    onClose();
  };

  const handleLogoutClick = () => {
    logout();
    onClose();
    navigate('/login');
  };

  const handleLanguageSelect = (code: string) => {
    setLanguage(code);
    setShowLanguages(false);
    onClose();
  };

  const handleEngineSelect = (engine: 'piper' | 'xtts') => {
    setTTSEngine(engine);
    setShowTTSSettings(false);
  };

  const handleVoiceSelect = (voice: string) => {
    setTTSVoice(voice);
    setShowTTSSettings(false);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <div className={styles.trigger} onClick={onToggle}>
        👤 {username}
      </div>
      {isOpen && (
        <div className={styles.menu}>
          {/* Language Selection */}
          <div className={styles.languageSection}>
            <button
              className={styles.item}
              onClick={(e) => {
                e.stopPropagation();
                setShowLanguages(!showLanguages);
              }}
            >
              <Globe size={16} />
              <span>Language: {LANGUAGES.find(l => l.code === selectedLanguage)?.name || 'English'}</span>
            </button>
            {showLanguages && (
              <div className={styles.languageList}>
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang.code)}
                    className={`${styles.languageItem} ${
                      selectedLanguage === lang.code ? styles.selected : ''
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TTS Engine & Voice Selection */}
          <div className={styles.languageSection}>
            <button
              className={styles.item}
              onClick={(e) => {
                e.stopPropagation();
                setShowTTSSettings(!showTTSSettings);
              }}
            >
              <Volume2 size={16} />
              <span>TTS: {ttsEngine === 'piper' ? 'Piper (fast)' : 'XTTS (HD)'} / Voice: {ttsVoice}</span>
            </button>
            {showTTSSettings && (
              <div className={styles.languageList}>
                <div style={{ padding: '4px 8px', fontSize: '11px', color: '#888' }}>Engine</div>
                <button
                  className={`${styles.languageItem} ${ttsEngine === 'piper' ? styles.selected : ''}`}
                  onClick={() => handleEngineSelect('piper')}
                >
                  Piper (fast, local)
                </button>
                <button
                  className={`${styles.languageItem} ${ttsEngine === 'xtts' ? styles.selected : ''}`}
                  onClick={() => handleEngineSelect('xtts')}
                >
                  XTTS (high-quality)
                </button>

                <div style={{ padding: '4px 8px', fontSize: '11px', color: '#888', marginTop: '4px' }}>Voice (Piper)</div>
                <button
                  className={`${styles.languageItem} ${ttsVoice === 'nova' ? styles.selected : ''}`}
                  onClick={() => handleVoiceSelect('nova')}
                >
                  Nova (female)
                </button>
                <button
                  className={`${styles.languageItem} ${ttsVoice === 'alloy' ? styles.selected : ''}`}
                  onClick={() => handleVoiceSelect('alloy')}
                >
                  Alloy (neutral)
                </button>
                <button
                  className={`${styles.languageItem} ${ttsVoice === 'echo' ? styles.selected : ''}`}
                  onClick={() => handleVoiceSelect('echo')}
                >
                  Echo (male)
                </button>
              </div>
            )}
          </div>

          <div className={styles.separator} />

          <button className={styles.item} onClick={handleHistoryClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            Chat History
          </button>
          <button className={styles.item} onClick={handleLogoutClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5M17 9l5 5-5 5"/>
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};
