import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '@/modules/chat';
import chatService from '@/modules/chat/services/chatService';
import ttsService from '@/modules/tts/services/ttsService';
import { detectEmotion } from '@/utils/emotionDetector';
import { SessionSummary } from '@/core/types';
import { useAuth } from '@/core/providers/AuthProvider';
import { useLLMStore, PROVIDER_OPTIONS, MODEL_OPTIONS } from '@/core/stores/llmStore';
import { sttService } from '@/modules/chat/services/sttService';

// TTS concurrency and length limits
const MAX_CONCURRENT_TTS = 2;
const MAX_TTS_LENGTH = 5000;

/**
 * GLOBAL_CSS — Glassmorphism conversion of ChatPage1.md inline styles
 *
 * Drop this string into the GLOBAL_CSS constant in ChatPage1.tsx,
 * injected via the <style> tag effect.
 *
 * All surfaces use backdrop-filter + rgba glass.
 * Animated gradient background inherited from .container.
 */

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  :root {
    /* ── Customizable gradient colors ── */
    --gradient-color-1: #0f0c29;
    --gradient-color-2: #2b6345;
    --gradient-color-3: #24243e;
    --gradient-color-4: #0f0c29;

    /* ── Animation & effects ── */
    --animation-duration: 15s;
    --blur-intensity: 20px;
    --glass-opacity: 0.08;
    --bubble-radius: 18px;

    /* ── Glass tokens ── */
    --glass-bg:           rgba(255, 255, 255, var(--glass-opacity));
    --glass-bg-hover:     rgba(255, 255, 255, calc(var(--glass-opacity) + 0.05));
    --glass-bg-strong:    rgba(255, 255, 255, calc(var(--glass-opacity) + 0.07));
    --glass-bg-dark:      rgba(0, 0, 0, 0.18);
    --glass-border:       rgba(255, 255, 255, 0.18);
    --glass-border-hover: rgba(255, 255, 255, 0.30);
    --glass-shadow:       0 25px 50px -12px rgba(0, 0, 0, 0.45);
    --glass-inset:        inset 0 1px 1px rgba(255, 255, 255, 0.12);

    /* ── Text ── */
    --text-primary:    #ffffff;
    --text-secondary:  rgba(255, 255, 255, 0.70);
    --text-muted:      rgba(255, 255, 255, 0.40);

    /* ── Accent ── */
    --accent:          #7163f1;
    --accent-hover:    #818cf8;
    --accent-glow:     rgba(113, 99, 241, 0.25);

    /* ── Semantic ── */
    --error-bg:        rgba(239, 68, 68, 0.18);
    --error-border:    #f87171;
    --error-text:      #fca5a5;
    --success-bg:      rgba(34, 197, 94, 0.18);
    --success-border:  #22c55e;
    --success-text:    #86efac;
    --highlight-bg:    rgba(113, 99, 241, 0.30);

    /* ── Code ── */
    --code-inline-bg:  rgba(255, 255, 255, 0.10);
    --code-bg:         rgba(0, 0, 0, 0.30);
    --code-text:       #e2e8f0;

    /* ── Typography ── */
    --font:      'DM Sans', sans-serif;
    --mono:      'DM Mono', monospace;

    /* ── Radius ── */
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: var(--bubble-radius);
    --radius-xl: 24px;

    /* ── Shadows ── */
    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.20);
    --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.30);
    --shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.40);

    --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ══════════════════════════════════════════
     Root layout
  ══════════════════════════════════════════ */
  .chat-root {
    font-family: var(--font);
    color: var(--text-primary);
    height: calc(100vh - 60px);
    display: flex;
    overflow: hidden;
    background: linear-gradient(-45deg, var(--gradient-color-1), var(--gradient-color-2), var(--gradient-color-3), var(--gradient-color-4));
    background-size: 400% 400%;
    animation: gradientShift var(--animation-duration) ease infinite;
    position: relative;
  }

  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50%       { background-position: 100% 50%; }
  }

  /* Floating orbs */
  .chat-root::before,
  .chat-root::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.45;
    animation: float 8s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  .chat-root::before {
    width: 420px; height: 420px;
    background: #6366f1;
    top: -120px; left: -120px;
  }
  .chat-root::after {
    width: 320px; height: 320px;
    background: #ec4899;
    bottom: -60px; right: -60px;
    animation-delay: -4s;
  }

  @keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%       { transform: translate(30px, 30px) scale(1.1); }
  }

  /* ══════════════════════════════════════════
     Root layout
  ══════════════════════════════════════════ */
   .chat-root {
     font-family: var(--font);
     color: var(--text-primary);
     height: calc(100vh - 60px);
     display: flex;
     overflow: hidden;
     background: linear-gradient(-45deg, var(--gradient-color-1), var(--gradient-color-2), var(--gradient-color-3), var(--gradient-color-4));
     background-size: 400% 400%;
     animation: gradientShift var(--animation-duration) ease infinite;
     position: relative;
   }

  @keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50%       { background-position: 100% 50%; }
  }

  /* Floating orbs on root */
  .chat-root::before,
  .chat-root::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.40;
    animation: floatOrb 8s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  .chat-root::before {
    width: 420px; height: 420px;
    background: #6366f1;
    top: -120px; left: -120px;
  }
  .chat-root::after {
    width: 320px; height: 320px;
    background: #ec4899;
    bottom: -60px; right: -60px;
    animation-delay: -4s;
  }

  @keyframes floatOrb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%       { transform: translate(30px, 30px) scale(1.1); }
  }

  /* ══════════════════════════════════════════
     Sidebar
  ══════════════════════════════════════════ */
  .sidebar {
    width: 260px;
    min-width: 260px;
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-right: 1px solid var(--glass-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    z-index: 2;
    transition: width var(--transition), min-width var(--transition), opacity var(--transition);
  }
  .sidebar.hidden {
    width: 0;
    min-width: 0;
    opacity: 0;
    pointer-events: none;
    border-right: none;
  }

  .sidebar-header {
    padding: 20px 16px 14px;
    border-bottom: 1px solid var(--glass-border);
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
  }
  .sidebar-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sidebar-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .sidebar-search {
    width: 100%;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg-dark);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    font-family: inherit;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .sidebar-search::placeholder { color: var(--text-muted); }
  .sidebar-search:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .btn-new-chat {
    margin: 12px 14px;
    padding: 10px 14px;
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    color: var(--accent-hover);
    font-family: var(--font);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background var(--transition), border-color var(--transition), box-shadow var(--transition);
    flex-shrink: 0;
  }
  .btn-new-chat:hover {
    background: var(--glass-bg-hover);
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent), var(--glass-inset);
    color: var(--text-primary);
  }

  .sessions-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.15) transparent;
  }
  .sessions-list::-webkit-scrollbar       { width: 4px; }
  .sessions-list::-webkit-scrollbar-track { background: transparent; }
  .sessions-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

  .session-item {
    padding: 10px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition), border-color var(--transition);
    margin-bottom: 2px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border: 1px solid transparent;
  }
  .session-item:hover {
    background: var(--glass-bg-hover);
    border-color: var(--glass-border);
  }
  .session-item.active {
    background: var(--glass-bg-strong);
    border-color: var(--glass-border-hover);
    box-shadow: var(--glass-inset);
  }

  .session-item-content { flex: 1; min-width: 0; }
  .session-item-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .session-item-meta {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
    display: flex;
    gap: 8px;
  }

  .session-delete-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    opacity: 0;
    transition: all var(--transition);
    flex-shrink: 0;
  }
  .session-item:hover .session-delete-btn { opacity: 1; }
  .session-delete-btn:hover {
    background: var(--error-bg);
    color: var(--error-text);
    border: 1px solid var(--error-border);
  }
  .session-delete-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  /* ══════════════════════════════════════════
     Main Panel
  ══════════════════════════════════════════ */
  .main-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  /* ══════════════════════════════════════════
     Topbar
  ══════════════════════════════════════════ */
  .topbar {
    height: 56px;
    padding: 0 16px;
    border-bottom: 1px solid var(--glass-border);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: var(--glass-inset);
  }

  .icon-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--glass-border);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: background var(--transition), color var(--transition), border-color var(--transition);
    flex-shrink: 0;
  }
  .icon-btn:hover {
    background: var(--glass-bg-hover);
    color: var(--text-primary);
    border-color: var(--glass-border-hover);
  }
  .icon-btn.delete-btn:hover {
    background: var(--error-bg);
    color: var(--error-text);
    border-color: var(--error-border);
  }
  .icon-btn.active {
    background: var(--glass-bg-strong);
    color: var(--accent-hover);
    border-color: var(--accent);
    box-shadow: var(--glass-inset);
  }

  .topbar-title {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    text-align: center;
  }
  

  /* ══════════════════════════════════════════
     Search Bar
  ══════════════════════════════════════════ */
  .search-bar {
    padding: 10px 16px;
    border-bottom: 1px solid var(--glass-border);
    display: flex;
    gap: 8px;
    align-items: center;
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    flex-shrink: 0;
  }
  .search-input {
    flex: 1;
    padding: 8px 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg-dark);
    color: var(--text-primary);
    font-family: var(--font);
    font-size: 13px;
    outline: none;
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .search-input::placeholder { color: var(--text-muted); }
  .search-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .search-close-btn {
    padding: 7px 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    color: var(--text-secondary);
    font-family: var(--font);
    font-size: 12px;
    cursor: pointer;
    transition: background var(--transition), color var(--transition);
  }
  .search-close-btn:hover {
    background: var(--glass-bg-hover);
    color: var(--text-primary);
    border-color: var(--glass-border-hover);
  }

  /* ══════════════════════════════════════════
     Messages Area
  ══════════════════════════════════════════ */
   .messages-area {
     flex: 1;
     min-height: 0;
     overflow-y: auto;
     padding: 24px 0 0 0;
     scrollbar-width: thin;
     scrollbar-color: rgba(255,255,255,0.15) transparent;
   }
  .messages-area::-webkit-scrollbar       { width: 4px; }
  .messages-area::-webkit-scrollbar-track { background: transparent; }
  .messages-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

  .messages-inner {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ══════════════════════════════════════════
     Empty / Welcome State
  ══════════════════════════════════════════ */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 32px;
    text-align: center;
    min-height: 60vh;
    gap: 12px;
  }
  .empty-state-logo {
    width: 60px;
    height: 60px;
    border-radius: var(--bubble-radius);
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    margin-bottom: 8px;
    box-shadow: 0 0 32px rgba(113, 99, 241, 0.40), var(--glass-inset);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  .empty-state-heading {
    font-size: 26px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }
  .empty-state-sub {
    font-size: 15px;
    color: var(--text-secondary);
    max-width: 360px;
    line-height: 1.6;
  }

  .suggestion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 16px;
    max-width: 480px;
  }
  .suggestion-chip {
    padding: 9px 16px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: var(--text-secondary);
    font-family: var(--font);
    font-size: 13px;
    cursor: pointer;
    transition: background var(--transition), border-color var(--transition), color var(--transition), transform var(--transition);
    box-shadow: var(--glass-inset);
  }
  .suggestion-chip:hover {
    background: var(--glass-bg-hover);
    border-color: var(--accent);
    color: var(--text-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(113, 99, 241, 0.25), var(--glass-inset);
  }

  /* ══════════════════════════════════════════
     Message Rows
  ══════════════════════════════════════════ */
  .message-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
    padding: 2px 0;
  }
  .message-row.user      { align-items: flex-end; }
  .message-row.assistant { align-items: flex-start; }

   .message-bubble {
     max-width: 65%;
     padding: 11px 16px;
     border-radius: var(--radius-lg);
     font-size: 14px;
     line-height: 1.65;
     position: relative;
     word-break: break-word;
     cursor: pointer;
     transition: box-shadow var(--transition), transform var(--transition);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  /* User bubble */
  .message-row.user .message-bubble {
    background: linear-gradient(135deg, rgba(113, 99, 241, 0.50), rgba(220, 92, 246, 0.4));
    color: white;
    border-bottom-right-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 16px rgba(113, 99, 241, 0.30), var(--glass-inset);
  }
  .message-row.user .message-bubble:hover {
    box-shadow: 0 4px 24px rgba(113, 99, 241, 0.45), var(--glass-inset);
  }

  /* Assistant bubble */
  .message-row.assistant .message-bubble {
    background: var(--glass-bg);
    color: var(--text-primary);
    border: 1px solid var(--glass-border);
    border-bottom-left-radius: 4px;
    box-shadow: var(--shadow-sm), var(--glass-inset);
  }
  .message-row.assistant .message-bubble:hover {
    background: var(--glass-bg-hover);
    box-shadow: var(--shadow-md), var(--glass-inset);
  }

  /* Markdown inside assistant bubble */
  .message-bubble p            { margin: 0 0 0.5em; }
  .message-bubble p:last-child { margin: 0; }
  .message-bubble ul,
  .message-bubble ol           { margin: 0.4em 0; padding-left: 1.4em; }
  .message-bubble li           { margin: 0.2em 0; }
  .message-bubble code {
    font-family: var(--mono);
    font-size: 0.85em;
    background: var(--code-inline-bg);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.10);
  }
  .message-bubble pre code {
    display: block;
    background: var(--code-bg);
    color: var(--code-text);
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    overflow-x: auto;
    margin: 0.5em 0;
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-inset);
  }
  .message-bubble blockquote {
    border-left: 3px solid var(--accent);
    padding-left: 12px;
    margin: 0.6em 0;
    opacity: 0.8;
    font-style: italic;
  }

  /* ── Copy toast ── */
  .copy-toast {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--success-bg);
    border: 1px solid var(--success-border);
    color: var(--success-text);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: fadeUp 0.2s ease;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── Reaction badge ── */
  .reaction-badge {
    position: absolute;
    top: -8px;
    width: 22px;
    height: 22px;
    background: var(--glass-bg-strong);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    cursor: pointer;
    transition: transform var(--transition);
    z-index: 5;
  }
  .reaction-badge:hover { transform: scale(1.15); }
  .message-row.user .reaction-badge      { right: -8px; }
  .message-row.assistant .reaction-badge { left: -8px; }

  /* ── Hover toolbar ── */
  .hover-toolbar {
    position: absolute;
    top: -36px;
    background: var(--glass-bg-strong);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 4px 6px;
    display: flex;
    gap: 2px;
    box-shadow: var(--glass-shadow), var(--glass-inset);
    z-index: 10;
  }
  .emoji-btn {
    width: 28px; height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--transition), transform var(--transition);
  }
  .emoji-btn:hover {
    background: var(--glass-bg-hover);
    transform: scale(1.15);
  }

  /* ── TTS play button ── */
  .tts-play-btn {
    height: 26px;
    padding: 0 10px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: var(--text-secondary);
    font-family: var(--font);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all var(--transition);
    box-shadow: var(--glass-inset);
  }
  .tts-play-btn:hover { background: var(--glass-bg-hover); color: var(--text-primary); }
  .tts-play-btn.playing {
    background: var(--error-bg);
    border-color: var(--error-border);
    color: var(--error-text);
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.25), var(--glass-inset);
  }
  .tts-play-btn.paused {
    background: rgba(113, 99, 241, 0.25);
    border-color: var(--accent);
    color: var(--accent-hover);
    box-shadow: 0 0 8px var(--accent-glow), var(--glass-inset);
  }

  /* ══════════════════════════════════════════
     Typing Indicator
  ══════════════════════════════════════════ */
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
  }
  .typing-dots {
    display: flex;
    gap: 4px;
    padding: 10px 14px;
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    border-bottom-left-radius: 4px;
    box-shadow: var(--glass-inset);
  }
  .typing-dot {
    width: 6px; height: 6px;
    background: var(--text-muted);
    border-radius: 50%;
    animation: typingBounce 1.4s infinite;
  }
  .typing-dot:nth-child(1) { animation-delay: -0.32s; }
  .typing-dot:nth-child(2) { animation-delay: -0.16s; }
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); background: var(--text-muted); }
    30%            { transform: translateY(-5px); background: var(--accent-hover); }
  }

  /* ── Streaming bubble ── */
  .streaming-bubble {
    max-width: 72%;
    padding: 11px 16px;
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    border-bottom-left-radius: 4px;
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-primary);
    box-shadow: var(--shadow-sm), var(--glass-inset);
    position: relative;
  }
  .streaming-bubble::after {
    content: '▋';
    display: inline-block;
    color: var(--accent-hover);
    animation: cursorBlink 1s infinite;
    margin-left: 2px;
  }
  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }

   /* ══════════════════════════════════════════
      Input Bar
   ══════════════════════════════════════════ */
   .input-bar {
     padding: 12px 24px 16px;
     background: var(--glass-bg);
     backdrop-filter: blur(24px);
     -webkit-backdrop-filter: blur(24px);
     border-top: 1px solid var(--glass-border);
     box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.20), var(--glass-inset);
     flex-shrink: 0;
   }

    .input-bar-inner {
      display: flex;
      gap: 6px;
      align-items: center;
      width: 100%;
    }

    .input-bar-inner > * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

   .selector-group {
     display: flex;
     gap: 6px;
     flex-shrink: 0;
     align-items: center;
   }

 /* Center empty state message and text */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 32px;
  text-align: center;
  min-height: 60vh;
  gap: 12px;
  width: 100%;
}

.empty-state-heading {
  font-size: 26px;
  font-weight: 600;
  text-align: center;
  margin: 0 auto;
}

/* Balance overall input bar against sidebar width change */
.main-panel {
  transition: margin 0.3s ease;
}

.sidebar.hidden ~ .main-panel {
  margin-left: 0;
}


    .chat-input {
      flex: 1;
      padding: 10px 16px;
      border-radius: 12px;
      border: 1px solid var(--glass-border);
      background: var(--glass-bg-dark);
      color: var(--text-primary);
      font-family: var(--font);
      font-size: 14px;
      outline: none;
      resize: none;
      line-height: 1.5;
      min-height: 40px;
      max-height: 120px;
      transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
      overflow-y: auto;
    }
  .chat-input::placeholder { color: var(--text-muted); }
  .chat-input:focus {
    border-color: var(--accent);
    background: rgba(255, 255, 255, 0.10);
    box-shadow: 0 0 0 3px var(--accent-glow), var(--glass-inset);
  }
  .chat-input:disabled { opacity: 0.45; cursor: not-allowed; }

   .send-btn {
     box-sizing: border-box;
     width: 40px; height: 40px;
     border-radius: 12px;
     border: none;
     background: var(--accent);
     color: white;
     cursor: pointer;
     display: flex;
     align-items: center;
     justify-content: center;
     font-size: 16px;
     flex-shrink: 0;
     transition: background var(--transition), transform 0.15s;
   }
   .send-btn:hover:not(:disabled) {
     background: var(--accent-hover);
     transform: translateY(-1px);
   }
   .send-btn:active:not(:disabled) {
     transform: scale(0.95);
   }
   .send-btn:disabled {
     background: var(--glass-bg-strong);
     color: var(--text-muted);
     cursor: not-allowed;
     transform: none;
   }

   .stop-btn {
     box-sizing: border-box;
     width: 40px; height: 40px;
     border-radius: 12px;
     border: none;
     background: var(--error-bg);
     color: var(--error-text);
     cursor: pointer;
     display: flex;
     align-items: center;
     justify-content: center;
     font-size: 16px;
     flex-shrink: 0;
     transition: background var(--transition);
   }
   .stop-btn:hover {
     background: #dc2626;
     color: white;
   }

    .tts-btn {
      box-sizing: border-box;
      height: 40px;
      padding: 0 12px;
      border-radius: 12px;
      border: 1px solid var(--glass-border);
      background: var(--glass-bg);
      color: var(--text-secondary);
      font-family: var(--font);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      transition: all var(--transition);
    }
    .tts-btn:hover {
      background: var(--glass-bg-hover);
      color: var(--text-primary);
      border-color: var(--glass-border-hover);
    }
    .tts-btn.manual {
      border-color: var(--accent);
      color: var(--accent-hover);
      background: rgba(113, 99, 241, 0.15);
    }
    .tts-btn.auto {
      border-color: var(--success-border);
      color: var(--success-text);
      background: var(--success-bg);
    }

   /* ══════════════════════════════════════════
      Selector Group & Dropdowns
   ══════════════════════════════════════════ */
   .selector-group {
     display: flex;
     gap: 6px;
     flex-shrink: 0;
     align-items: center;
   }

    .glass-select {
      box-sizing: border-box;
      height: 40px;
      padding: 0 32px 0 10px;
      border-radius: 12px;
      border: 1px solid var(--glass-border);
      background: var(--glass-bg);
      color: var(--text-primary);
      font-family: inherit;
      font-size: 13px;
      outline: none;
      cursor: pointer;
      transition: border-color var(--transition), background var(--transition), box-shadow var(--transition), transform var(--transition);
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23777777' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 120px;
      flex-shrink: 0;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: var(--shadow-sm), var(--glass-inset);
      position: relative;
      z-index: 1;
    }
    .glass-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow), var(--shadow-sm), var(--glass-inset);
      transform: translateY(-1px);
      background: var(--glass-bg-hover);
    }
    .glass-select:hover {
      border-color: var(--glass-border-hover);
      background: var(--glass-bg-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md), var(--glass-inset);
    }
      .glass-select option {
        background: rgba(17, 24, 39, 0.98);
        color: var(--text-primary);
        padding: 8px 12px;
        font-size: 13px;
        border: none;
        border-bottom: 1px solid var(--glass-border);
        transition: background var(--transition);
      }

      .glass-select option:hover {
        background: rgba(30, 41, 59, 0.98);
      }

    /* ══════════════════════════════════════════
       Mic Button
    ══════════════════════════════════════════ */
   .mic-btn {
     box-sizing: border-box;
     width: 40px; height: 40px;
     border-radius: 12px;
     border: none;
     display: flex;
     align-items: center;
     justify-content: center;
     cursor: pointer;
     transition: background var(--transition), transform 0.15s;
     flex-shrink: 0;
     color: white;
     font-size: 18px;
   }
   .mic-btn:hover:not(:disabled) {
     transform: translateY(-1px);
   }
   .mic-btn:active:not(:disabled) {
     transform: scale(0.95);
   }
   .mic-btn:disabled {
     opacity: 0.5;
     cursor: not-allowed;
     transform: none;
   }
   .mic-btn.recording {
     background: #e40000;
   }
   .mic-btn.transcribing {
     background: #2014d17b;
   }
   .mic-btn:not(.recording):not(.transcribing) {
     background: #c522b2;
   }

  /* ══════════════════════════════════════════
     Sessions empty state
  ══════════════════════════════════════════ */
  .sessions-empty {
    padding: 24px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .sessions-empty-icon  { font-size: 24px; opacity: 0.5; }
  .sessions-empty-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
  .sessions-empty-sub   { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

  /* ══════════════════════════════════════════
     Highlight (search match)
  ══════════════════════════════════════════ */
  mark {
    background: var(--highlight-bg);
    color: var(--text-primary);
    border-radius: 3px;
    padding: 0 2px;
    border: 1px solid rgba(113, 99, 241, 0.30);
  }

  /* ══════════════════════════════════════════
     Message meta (timestamp + read ticks)
  ══════════════════════════════════════════ */
  .message-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: var(--text-muted);
    padding: 0 4px;
    margin-top: 1px;
  }
`;
/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
export function ChatPage() {
  const {
    messages, currentSessionId, createSession, sendMessage,
    loadSession, resetChat, deleteSession, isLoading, isStreaming, error, currentText, selectedLanguage, stopGeneration, isLoadingSession
  } = useChat();
   const { user } = useAuth();
   // selectedLanguage already from useChat
   const llmStore = useLLMStore();
   const selectedProvider = llmStore.provider;
   const selectedModel = llmStore.model;
   const setSelectedProvider = llmStore.setProvider;
   const setSelectedModel = llmStore.setModel;

     // Migrate invalid persisted provider to 'ollama'
     useEffect(() => {
       const validProviders = PROVIDER_OPTIONS.map(p => p.value);
       if (!validProviders.includes(selectedProvider)) {
         setSelectedProvider('ollama');
       }
     // eslint-disable-next-line react-hooks/exhaustive-deps
     }, []);

  const [input, setInput] = useState('');
  const [ttsMode, setTtsMode] = useState<'off' | 'manual' | 'auto'>(() => {
    const s = localStorage.getItem('ttsMode');
    return (s === 'off' || s === 'manual' || s === 'auto') ? s : 'off';
  });
   const [ttsSentences, setTtsSentences] = useState<{ [key: number]: Array<{ text: string; audio: string | null; status: 'pending' | 'generating' | 'ready' | 'error' }> }>({});
  const ttsSentencesRef = useRef(ttsSentences);
  useEffect(() => { ttsSentencesRef.current = ttsSentences; }, [ttsSentences]);

  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [waitingSentence, setWaitingSentence] = useState<{msgIdx: number; sentIdx: number} | null>(null);
  const [ttsCompleted, setTtsCompleted] = useState<Record<number, boolean>>({});
  const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<number, string>>({});
  const [copiedMessage, setCopiedMessage] = useState<string | number | null>(null);
   const [searchTerm, setSearchTerm] = useState('');
   const [showSearch, setShowSearch] = useState(false);
   const [sessions, setSessions] = useState<SessionSummary[]>([]);
   const [showSidebar, setShowSidebar] = useState(true);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);

    // Filter sessions based on search term
   const filteredSessions = useMemo(() => {
     if (!searchTerm.trim()) return sessions;
     const term = searchTerm.toLowerCase();
     return sessions.filter(s =>
       String(s.session_id).includes(term) ||
       (s.started_at ? new Date(s.started_at).toLocaleDateString().toLowerCase().includes(term) : false)
     );
   }, [sessions, searchTerm]);
   const inputRef = useRef<HTMLTextAreaElement>(null);
    const mountedRef = useRef(true);
    const initializedTtsRef = useRef<Set<number>>(new Set());
    const existingAssistantIdsRef = useRef<Set<number>>(new Set());
    const prevIsStreamingRef = useRef(isStreaming);
    const stopRequestedRef = useRef(false);
    const activeTtsMessageRef = useRef<number | null>(null);
    const streamingTtsBuffer = useRef<string>('');
    const streamingTtsMsgIdx = useRef<number | null>(null);
    const streamingTtsNextSentIdx = useRef<number>(0);
    const prevCurrentTextRef = useRef<string>('');
    const ttsTimeoutIdsRef = useRef<number[]>([]);
    const ttsPendingQueue = useRef<Array<{msgIdx: number, sentIdx: number, text: string, emotion: string}>>([]);
    const activeTtsCount = useRef<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const prevAssistantCount = useRef<number>(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const mimeTypeRef = useRef<string>('');

  /* inject global CSS once */
  useEffect(() => {
    const id = 'chat-page-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = GLOBAL_CSS;
      document.head.appendChild(el);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  useEffect(() => { localStorage.setItem('ttsMode', ttsMode); }, [ttsMode]);
  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { if (showSidebar && sessions.length === 0) loadSessions(); }, [showSidebar]);
   useEffect(() => {
     const p = new URLSearchParams(window.location.search);
     const s = p.get('session');
     if (s && !currentSessionId) {
       const n = parseInt(s);
       if (!isNaN(n)) {
      loadSession(n).then(session => {
        if (session) {
          // Set TTS baseline to current assistant count for this session
          prevAssistantCount.current = session.messages.filter(m => m.role === 'assistant').length;
          // Mark historical assistant messages to prevent TTS playback
          const assistantIndices = new Set<number>();
          session.messages.forEach((msg, idx) => {
            if (msg.role === 'assistant') assistantIndices.add(idx);
          });
          existingAssistantIdsRef.current = assistantIndices;
        }
      });
       }
     }
   }, [currentSessionId, loadSession]);
    useEffect(() => {
      return () => {
        // Clear all pending TTS timeouts
        ttsTimeoutIdsRef.current.forEach(clearTimeout);
        ttsTimeoutIdsRef.current = [];
        
        // Signal cancellation to any in-flight TTS operations
        stopRequestedRef.current = true;
        
        // Clear TTS queues and reset counters
        ttsPendingQueue.current = [];
        activeTtsCount.current = 0;
        initializedTtsRef.current.clear();
        ttsSentencesRef.current = {};
        activeTtsMessageRef.current = null;
        
        // Abort any ongoing chat streaming request
        chatService.stopGeneration();
        
        // Stop audio playback
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        
        // Mark as unmounted
        mountedRef.current = false;
      };
    }, [chatService]);

   /* ── TTS helpers (sentence-level streaming) ── */

    const scheduleTTS = useCallback(() => {
      console.log('scheduleTTS called, queue len:', ttsPendingQueue.current.length, 'activeCount:', activeTtsCount.current);
      if (!mountedRef.current) return;
      while (activeTtsCount.current < MAX_CONCURRENT_TTS && ttsPendingQueue.current.length > 0) {
       // Peek at the first pending item without removing it yet
       const peekItem = ttsPendingQueue.current[0];
       if (!peekItem) break;
       const { msgIdx } = peekItem;
       // Ensure the message's sentence array is initialized in state/ref
       if (!ttsSentencesRef.current[msgIdx]) {
         // Not ready yet; retry after a short delay
         const timeoutId = setTimeout(scheduleTTS, 50);
         ttsTimeoutIdsRef.current.push(timeoutId);
         break;
       }
       // Now safe to shift
       const { sentIdx, text, emotion } = ttsPendingQueue.current.shift()!;
       activeTtsCount.current++;

        setTtsSentences(prev => {
          const arr = prev[msgIdx];
          if (!arr) {
            console.warn('scheduleTTS: no sentences for msgIdx', msgIdx);
            return prev;
          }
          const newArr = [...arr];
          newArr[sentIdx] = { ...newArr[sentIdx], status: 'generating' };
          return { ...prev, [msgIdx]: newArr };
        });

       const attemptGenerate = async (retries: number) => {
         if (!mountedRef.current) return;
         console.log(`TTS attemptGenerate: msgIdx=${msgIdx}, sentIdx=${sentIdx}, retries=${retries}`);
         try {
          const truncated = text.length > MAX_TTS_LENGTH ? text.slice(0, MAX_TTS_LENGTH) : text;
          console.log('Calling ttsService.generate...');
          const res = await ttsService.generate(truncated, emotion, undefined, undefined, selectedLanguage);
          console.log('TTS generate success, got audio length:', res.audio?.length);
          if (!mountedRef.current) return;
          if (stopRequestedRef.current) {
            // Mark as error/cancelled to exit spinner state
            setTtsSentences(prev => {
              const arr = prev[msgIdx];
              if (!arr) return prev;
              const newArr = [...arr];
              newArr[sentIdx] = { ...newArr[sentIdx], status: 'error' };
              return { ...prev, [msgIdx]: newArr };
            });
            return;
          }
          setTtsSentences(prev => {
            const arr = prev[msgIdx];
            if (!arr) return prev;
            const newArr = [...arr];
            newArr[sentIdx] = { ...newArr[sentIdx], status: 'ready', audio: res.audio };
            console.log(`TTS sentence ready: msgIdx=${msgIdx}, sentIdx=${sentIdx}`);
            return { ...prev, [msgIdx]: newArr };
          });
          } catch (e) {
           console.error('TTS attemptGenerate error:', e);
           if (retries > 0) {
             await new Promise<void>((resolve) => {
               const id = setTimeout(() => resolve(), 200 * (3 - retries));
               ttsTimeoutIdsRef.current.push(id);
             });
             return attemptGenerate(retries - 1);
           } else {
            if (!mountedRef.current) return;
            console.error('TTS failed for sentence', text, e);
            setTtsSentences(prev => {
              const arr = prev[msgIdx];
              if (!arr) return prev;
              const newArr = [...arr];
              newArr[sentIdx] = { ...newArr[sentIdx], status: 'error' };
              return { ...prev, [msgIdx]: newArr };
            });
          }
         } finally {
           activeTtsCount.current--;
           // Schedule next pending sentence(s) if capacity freed
           scheduleTTS();
         }
      };
      attemptGenerate(2);
    }
  }, [selectedLanguage]);  // Re-create when language changes so new TTS uses correct language

    const initializeMessageTTS = useCallback((msgIdx: number, content: string) => {
      if (initializedTtsRef.current.has(msgIdx)) {
        console.log('TTS already initialized for msgIdx', msgIdx);
        return;
      }
      initializedTtsRef.current.add(msgIdx);
      stopRequestedRef.current = false;
      setTtsCompleted(prev => ({ ...prev, [msgIdx]: false }));
      const emotion = detectEmotion(content);
      // Split into sentences for more natural playback
      const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
      const newSentences = sentences.map(s => ({
        text: s.trim(),
        audio: null,
        status: 'pending' as const
      }));
      ttsSentencesRef.current[msgIdx] = newSentences;
      setTtsSentences(prev => ({ ...prev, [msgIdx]: newSentences }));
      newSentences.forEach((s, si) => {
        ttsPendingQueue.current.push({ msgIdx, sentIdx: si, text: s.text, emotion });
      });
      // Defer to next tick to ensure state is committed before queue processing
      console.log(`TTS init for msgIdx ${msgIdx}, ${newSentences.length} sentences queued`);
      const timeoutId = setTimeout(scheduleTTS, 0);
      ttsTimeoutIdsRef.current.push(timeoutId);
    }, [scheduleTTS]);

   const queueSentenceForStreaming = useCallback((msgIdx: number, text: string, emotion: string, sentIdx: number) => {
     if (!ttsSentencesRef.current[msgIdx]) {
       ttsSentencesRef.current[msgIdx] = [];
       setTtsSentences(prev => ({ ...prev, [msgIdx]: [] }));
     }
     const sentence = { text, audio: null as string | null, status: 'pending' as const };
     ttsSentencesRef.current[msgIdx][sentIdx] = sentence;
     setTtsSentences(prev => {
       const arr = prev[msgIdx] || [];
       const newArr = [...arr];
       newArr[sentIdx] = sentence;
       return { ...prev, [msgIdx]: newArr };
     });
     ttsPendingQueue.current.push({ msgIdx, sentIdx, text, emotion });
     scheduleTTS();
   }, [setTtsSentences, scheduleTTS]);

     const clearTTS = () => {
       stopRequestedRef.current = true;
       setTtsSentences({});
       setTtsCompleted({});
       ttsPendingQueue.current = [];
       activeTtsCount.current = 0;
       initializedTtsRef.current.clear();
       ttsSentencesRef.current = {};  // reset ref
       activeTtsMessageRef.current = null;
       setWaitingSentence(null);
     };

     const stopAudio = useCallback(() => {
       if (!mountedRef.current) return;
       stopRequestedRef.current = true;
       audioRef.current?.pause();
       audioRef.current = null;
       activeTtsMessageRef.current = null;
       if (playingIdx !== null) {
         setTtsCompleted(prev => ({ ...prev, [playingIdx]: true }));
       }
       setPlayingIdx(null);
       setWaitingSentence(null);
     }, [playingIdx, setTtsCompleted]);

    const playSentence = useCallback((msgIdx: number, sentIdx: number) => {
      const sentence = ttsSentences[msgIdx]?.[sentIdx];
      if (!sentence?.audio) return;
      activeTtsMessageRef.current = msgIdx; // mark this message as actively playing
      const url = ttsService.toBlobUrl(sentence.audio, 'wav');
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => stopAudio());
        audio.onended = () => {
          if (!mountedRef.current) return;
          if (stopRequestedRef.current) {
            setPlayingIdx(null);
            audioRef.current = null;
            return;
          }
          const nextIdx = sentIdx + 1;
          const nextSentences = ttsSentences[msgIdx];
          if (nextIdx < nextSentences.length && nextSentences[nextIdx]?.status === 'ready') {
            playSentence(msgIdx, nextIdx);
          } else if (nextIdx < nextSentences.length) {
            setWaitingSentence({ msgIdx, sentIdx: nextIdx });
            setPlayingIdx(null);
            audioRef.current = null;
            // keep activeTtsMessageRef.current = msgIdx while waiting
          } else {
            // All sentences completed
            setTtsCompleted(prev => ({ ...prev, [msgIdx]: true }));
            setPlayingIdx(null);
            audioRef.current = null;
            activeTtsMessageRef.current = null;
          }
        };
      audio.onerror = () => stopAudio();
    }, [ttsSentences, stopAudio]);

     const playMessage = useCallback((msgIdx: number, startSentIdx?: number) => {
       // Stop any currently playing audio before starting
       stopAudio();
       stopRequestedRef.current = false; // reset stop flag for fresh playback
       const sentences = ttsSentences[msgIdx];
       if (!sentences) return;
       const startIdx = startSentIdx ?? sentences.findIndex(s => s.status === 'ready');
       if (startIdx === -1) return;
       setPlayingIdx(msgIdx);
       playSentence(msgIdx, startIdx);
     }, [ttsSentences, playSentence, stopAudio]);

     const playMessageAudio = useCallback((msgIdx: number) => {
       const msg = messages[msgIdx];
       if (!msg?.audio) return;
       stopAudio();
       stopRequestedRef.current = false;
       activeTtsMessageRef.current = msgIdx; // mark this message as actively playing
       setPlayingIdx(msgIdx);
        const url = ttsService.toBlobUrl(msg.audio, 'wav');
       const audio = new Audio(url);
       audioRef.current = audio;
       audio.play().catch(() => stopAudio());
        audio.onended = () => {
          if (!mountedRef.current) return;
          if (stopRequestedRef.current) {
            setPlayingIdx(null);
            audioRef.current = null;
            activeTtsMessageRef.current = null;
            return;
          }
          setTtsCompleted(prev => ({ ...prev, [msgIdx]: true }));
          setPlayingIdx(null);
          audioRef.current = null;
          activeTtsMessageRef.current = null;
        };
       audio.onerror = () => stopAudio();
     }, [messages, stopAudio]);

    const handleTtsToggle = () => {
      const next = ttsMode === 'off' ? 'manual' : ttsMode === 'manual' ? 'auto' : 'off';
      if (next === 'off') {
        // Stop playback and cancel pending TTS, preserve generated audio
        stopAudio();
        ttsPendingQueue.current = [];
        // Mark all existing assistant TTS messages as completed to prevent auto-play when re-enabled
        const completedUpdates: Record<number, boolean> = {};
        messages.forEach((msg, idx) => {
          if (msg.role === 'assistant' && (msg.audio || ttsSentencesRef.current[idx])) {
            completedUpdates[idx] = true;
          }
        });
        setTtsCompleted(prev => ({ ...prev, ...completedUpdates }));
      } else {
        stopRequestedRef.current = false;
        ttsPendingQueue.current = [];
        messages.forEach((msg, idx) => {
          if (msg.role === 'assistant' && !existingAssistantIdsRef.current.has(idx)) {
            if (ttsSentencesRef.current[idx]) return;
            initializeMessageTTS(idx, msg.content);
          }
        });
      }
      setTtsMode(next);
    };

   // Auto-create session on initial mount only (if no session in URL)
   useEffect(() => {
     const p = new URLSearchParams(window.location.search);
     const s = p.get('session');
     if (!s) {
       createSession();
     }
   }, [createSession]);

     // Initialize sentence TTS for new assistant messages when TTS is enabled
     useEffect(() => {
       if (ttsMode === 'off' || isLoadingSession) return;
       // Reset stop flag to allow generation on fresh init
       stopRequestedRef.current = false;
       messages.forEach((msg, idx) => {
         if (msg.role === 'assistant' && !existingAssistantIdsRef.current.has(idx) && !msg.audio) {
           // Skip if TTS already initialized for this message (e.g., from streaming pipeline)
           if (ttsSentencesRef.current[idx]) {
             return;
           }
           initializeMessageTTS(idx, msg.content);
         }
       });
     }, [messages.length, ttsMode, initializeMessageTTS, isLoadingSession]);

       // Auto-play latest ready message in 'auto' mode (only for newly generated replies)
       useEffect(() => {
         if (ttsMode !== 'auto' || activeTtsMessageRef.current !== null) return;
         for (let i = messages.length - 1; i >= 0; i--) {
           const msg = messages[i];
            if (
              msg.role === 'assistant'
              && !ttsCompleted[i]
              && !existingAssistantIdsRef.current.has(i)
            ) {
             // Check for sentence-level TTS (streaming) OR direct audio (non-streaming TTS)
             const hasReadySentences = ttsSentences[i]?.some(s => s.status === 'ready');
             const hasDirectAudio = !!msg.audio;
             
             if (hasReadySentences) {
               playMessage(i);
               break;
             } else if (hasDirectAudio) {
               playMessageAudio(i);
               break;
             }
           }
         }
       }, [ttsSentences, ttsMode, messages, playMessage, playMessageAudio, ttsCompleted]);

   // Streaming TTS: initialize on streaming start and clean up on end
   useEffect(() => {
     if (isStreaming && ttsMode !== 'off' && streamingTtsMsgIdx.current === null) {
       const msgIdx = messages.length;
       streamingTtsMsgIdx.current = msgIdx;
       streamingTtsNextSentIdx.current = 0;
       streamingTtsBuffer.current = '';
       prevCurrentTextRef.current = currentText;
       initializedTtsRef.current.add(msgIdx);
       setTtsSentences(prev => ({ ...prev, [msgIdx]: [] }));
       ttsSentencesRef.current[msgIdx] = [];
       setTtsCompleted(prev => ({ ...prev, [msgIdx]: false }));
       stopRequestedRef.current = false;

       // Catch up: process any text already streamed
       if (currentText) {
         const buffer = currentText;
         const sentenceRegex = /[^.!?]+[.!?]+/g;
         let match;
         let lastIndex = 0;
         while ((match = sentenceRegex.exec(buffer)) !== null) {
           const sentenceText = match[0].trim();
           if (sentenceText) {
             queueSentenceForStreaming(
               msgIdx,
               sentenceText,
               detectEmotion(sentenceText),
               streamingTtsNextSentIdx.current++
             );
           }
           lastIndex = sentenceRegex.lastIndex;
         }
         streamingTtsBuffer.current = buffer.slice(lastIndex);
       }
     }

     if ((!isStreaming || ttsMode === 'off') && streamingTtsMsgIdx.current !== null) {
       if (ttsMode !== 'off') {
         const remaining = streamingTtsBuffer.current.trim();
         if (remaining) {
           queueSentenceForStreaming(
             streamingTtsMsgIdx.current,
             remaining,
             detectEmotion(remaining),
             streamingTtsNextSentIdx.current
           );
         }
       }
       streamingTtsMsgIdx.current = null;
       streamingTtsBuffer.current = '';
       prevCurrentTextRef.current = '';
     }
   }, [isStreaming, messages.length, ttsMode, currentText, detectEmotion, queueSentenceForStreaming]);

   // Process streaming text and queue sentences as they complete
   useEffect(() => {
     if (!isStreaming) return;
     if (streamingTtsMsgIdx.current === null) return;
     if (ttsMode === 'off') return;

     const prev = prevCurrentTextRef.current;
     const current = currentText;
     const newText = current.slice(prev.length);
     prevCurrentTextRef.current = current;

     if (!newText) return;

     streamingTtsBuffer.current += newText;

     const buffer = streamingTtsBuffer.current;
     const sentenceRegex = /[^.!?]+[.!?]+/g;
     let match;
     let lastIndex = 0;
     const sentencesToQueue: Array<{text: string, emotion: string}> = [];

     while ((match = sentenceRegex.exec(buffer)) !== null) {
       const sentenceText = match[0].trim();
       if (sentenceText) {
         sentencesToQueue.push({ text: sentenceText, emotion: detectEmotion(sentenceText) });
       }
       lastIndex = sentenceRegex.lastIndex;
     }

     streamingTtsBuffer.current = buffer.slice(lastIndex);

     sentencesToQueue.forEach(({text, emotion}) => {
       queueSentenceForStreaming(
         streamingTtsMsgIdx.current!,
         text,
         emotion,
         streamingTtsNextSentIdx.current++
       );
     });
    }, [currentText, isStreaming, ttsMode, detectEmotion, queueSentenceForStreaming]);

    // Auto-focus input when streaming finishes (bot reply complete)
    useEffect(() => {
      if (prevIsStreamingRef.current === true && isStreaming === false) {
        inputRef.current?.focus();
      }
      prevIsStreamingRef.current = isStreaming;
    }, [isStreaming]);

    // Continue playback when next sentence becomes ready
   useEffect(() => {
    if (!waitingSentence) return;
    const {msgIdx, sentIdx} = waitingSentence;
    const sentences = ttsSentences[msgIdx];
    if (sentences && sentences[sentIdx]?.status === 'ready') {
      setWaitingSentence(null);
      setPlayingIdx(msgIdx);
      playSentence(msgIdx, sentIdx);
    }
  }, [waitingSentence, ttsSentences, playSentence]);

   const renderTtsButton = (msgIdx: number) => {
     const sentences = ttsSentences[msgIdx];
     const msg = messages[msgIdx];
     const hasDirectAudio = !!msg?.audio;
     
     // Check sentence-level TTS status
     const isGenerating = sentences?.some(s => s.status === 'generating');
     const hasReadySentences = sentences?.some(s => s.status === 'ready');
     
     if (isGenerating) {
       return <button className='tts-play-btn' disabled title='Generating audio...'><span className='spinner'>⟳</span></button>;
     }
     
     if (hasReadySentences) {
       return (
         <button
           className={'tts-play-btn ' + (playingIdx === msgIdx ? 'playing' : 'paused')}
           onClick={() => playingIdx === msgIdx ? stopAudio() : playMessage(msgIdx)}
           title={playingIdx === msgIdx ? 'Stop' : 'Play audio'}
         >
           {playingIdx === msgIdx ? '■' : '▶'}
         </button>
       );
     }
     
     if (hasDirectAudio) {
       return (
         <button
           className={'tts-play-btn ' + (playingIdx === msgIdx ? 'playing' : 'paused')}
           onClick={() => playingIdx === msgIdx ? stopAudio() : playMessageAudio(msgIdx)}
           title={playingIdx === msgIdx ? 'Stop' : 'Play audio'}
         >
           {playingIdx === msgIdx ? '■' : '▶'}
         </button>
       );
     }
     
     return null;
   };

    /* ── Input handlers ── */
    const handleSubmit = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading || isStreaming) return;
      const msg = input.trim();
      setInput('');
      await sendMessage({
        sessionId: currentSessionId!,
        message: msg,
        emotion: 'neutral',
        tts: ttsMode !== 'off',
        language: selectedLanguage
      });
    };

   const handleStop = useCallback(() => {
     stopGeneration();
   }, [stopGeneration]);

   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     if (e.key === 'Enter' && !e.shiftKey) {
       e.preventDefault();
       handleSubmit();
     }
   };

  /* auto-grow textarea */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
   };

  // Speech-to-text handlers
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Detect supported MIME type
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
            // ignore
          }
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
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current || 'audio/webm',
        });
        audioChunksRef.current = [];

        stream.getTracks().forEach((track) => track.stop());

        setIsTranscribing(true);
        try {
          const text = await sttService.transcribe(audioBlob, 'auto');
          setInput((prev) => prev + (prev ? ' ' : '') + text);
         } catch (err: any) {
           console.error('Transcription error:', err.message);
         } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
     } catch (err: any) {
       console.error('Microphone error:', err.message);
       setIsRecording(false);
     }
  }, []);

  const handleMicToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  /* ── Misc helpers ── */
  const formatTime = (timeStr: string) => {
    // Backend stores time as "HH:MM:SS" (no date). Prepend dummy date to make it parseable.
    const isTimeOnly = /^\d{2}:\d{2}:\d{2}$/.test(timeStr);
    const dateToParse = isTimeOnly ? `1970-01-01 ${timeStr}` : timeStr;
    return new Date(dateToParse).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

   const copyMessage = async (text: string, key: string | number) => {
     try {
       await navigator.clipboard.writeText(text);
       setCopiedMessage(key);
       const timeoutId = setTimeout(() => setCopiedMessage(null), 2000);
       ttsTimeoutIdsRef.current.push(timeoutId);
     } catch {}
   };

  const addReaction = (idx: number, emoji: string) => {
    setMessageReactions(prev => {
      if (prev[idx] === emoji) { const { [idx]: _, ...rest } = prev; return rest; }
      return { ...prev, [idx]: emoji };
    });
  };

  const toggleSearch = () => {
    setShowSearch(v => !v);
    if (showSearch) setSearchTerm('');
  };

  const filteredMessages = useMemo(() => messages.filter(msg =>
    searchTerm === '' ||
    msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatTime(msg.time).includes(searchTerm)
  ), [messages, searchTerm]);

   const highlightText = (text: string) => {
     if (!searchTerm) return text;
     return text.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark>$1</mark>');
    };

  // Highlight search matches in a DOM element
    const highlightElement = useCallback((el: HTMLElement, term: string) => {
      if (!term) return;

      // Clear existing <mark> tags
      el.querySelectorAll('mark').forEach(m => {
        const parent = m.parentNode;
        if (!parent) return;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      });

    const regex = new RegExp(`(${term})`, 'gi');
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const textNodes: any[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      const parent = textNode.parentElement;
      if (!parent) return;
      // Skip inside code blocks
      const tagName = parent.tagName;
      if (tagName === 'CODE' || tagName === 'PRE' || parent.closest('code') || parent.closest('pre')) {
        return;
      }
      const text = textNode.textContent;
      if (text && regex.test(text)) {
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
          }
          const mark = document.createElement('mark');
          mark.textContent = match[0];
          frag.appendChild(mark);
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode.replaceChild(frag, textNode);
      }
    });
  }, []);

   // Apply highlighting to assistant messages after render
    useEffect(() => {
      if (!searchTerm) {
        // Clear highlights when search is empty
        document.querySelectorAll('.message-row.assistant .message-bubble mark, .message-row.assistant .streaming-bubble mark').forEach(m => {
          const parent = m.parentNode;
          if (!parent) return;
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          parent.removeChild(m);
        });
        return;
      }

     const elements = document.querySelectorAll('.message-row.assistant .message-bubble, .message-row.assistant .streaming-bubble');
     elements.forEach(el => {
       highlightElement(el as HTMLElement, searchTerm);
     });
   }, [searchTerm, messages, currentText, isStreaming, highlightElement]);

   /* ── Session helpers ── */
    const loadSessions = async () => {
      try {
        if (mountedRef.current) {
          setLoadingSessions(true);
        }
        const fetchedSessions = await chatService.getSessions();
        // Sort by date descending (latest first)
        const sortedSessions = [...fetchedSessions].sort((a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );
        if (mountedRef.current) {
          setSessions(sortedSessions);
        }
      } catch {}
      finally {
        if (mountedRef.current) {
          setLoadingSessions(false);
        }
      }
    };

     const switchToSession = async (sessionId: number) => {
       try {
         if (mountedRef.current) {
           setLoadingSessions(true);
         }
         setInput(''); setSearchTerm(''); setShowSearch(false);
         setMessageReactions({}); clearTTS(); setPlayingIdx(null); stopAudio();
         existingAssistantIdsRef.current.clear();
     const session = await loadSession(sessionId);
     if (session) {
       // Set TTS baseline to current assistant count in this session
       prevAssistantCount.current = session.messages.filter(m => m.role === 'assistant').length;
       // Mark historical assistant messages to prevent TTS playback
       const assistantIndices = new Set<number>();
       session.messages.forEach((msg, idx) => {
         if (msg.role === 'assistant') assistantIndices.add(idx);
       });
       existingAssistantIdsRef.current = assistantIndices;
     }
         window.history.pushState({}, '', `${window.location.pathname}?session=${sessionId}`);
         // Refresh sessions list to update any changes (like new messages)
         await loadSessions();
       } catch {}
       finally {
         if (mountedRef.current) {
           setLoadingSessions(false);
         }
       }
     };

    const handleNewSession = async () => {
      // Remove session query param to prevent the URL effect from loading old session
      window.history.replaceState({}, '', window.location.pathname);

      // Clear all local state
      resetChat();
      // Reset TTS assistant count baseline for new empty session
      prevAssistantCount.current = 0;
       existingAssistantIdsRef.current.clear();
      setInput('');
      setSearchTerm('');
      setShowSearch(false);
      setMessageReactions({});
      clearTTS();
      setPlayingIdx(null);
      stopAudio();

     try {
       // Create new session
       const newSession = await createSession();
       if (newSession) {
         // Update URL with new session ID
         window.history.replaceState({}, '', `${window.location.pathname}?session=${newSession.session_id}`);
         // Refresh sessions list
         await loadSessions();
       }
     } catch (err) {
       console.error('Failed to create new session:', err);
     }
    };

     const handleDeleteCurrentSession = async () => {
       if (!currentSessionId) return;
       if (!window.confirm('Delete this conversation? This cannot be undone.')) return;

       try {
         await deleteSession(currentSessionId);
         if (!mountedRef.current) return;
         // Remove session query param from URL
         window.history.replaceState({}, '', window.location.pathname);
         // Refresh sessions list in sidebar
         await loadSessions();
         if (!mountedRef.current) return;
         // Clear local UI state
         setInput('');
         setSearchTerm('');
         setShowSearch(false);
         setMessageReactions({});
         clearTTS();
         setPlayingIdx(null);
         stopAudio();
       } catch (err) {
         console.error('Failed to delete session:', err);
       }
     };

     const handleDeleteSession = async (sessionId: number, e: React.MouseEvent) => {
       e.stopPropagation(); // Prevent switching to the session
       if (!window.confirm('Delete this conversation? This cannot be undone.')) return;

       try {
         await deleteSession(sessionId);
         if (!mountedRef.current) return;
         // Refresh sessions list to remove the deleted session
         await loadSessions();
         if (!mountedRef.current) return;
         // If we deleted the current session, also clear the UI
         if (sessionId === currentSessionId) {
           window.history.replaceState({}, '', window.location.pathname);
           setInput('');
           setSearchTerm('');
           setShowSearch(false);
           setMessageReactions({});
           clearTTS();
           setPlayingIdx(null);
           stopAudio();
         }
       } catch (err) {
         console.error('Failed to delete session:', err);
       }
      };

    // Cleanup STT resources on unmount
    useEffect(() => {
      return () => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };
    }, []);

      /* ── Error state ── */
      // Filter out STT-related errors (handled inline in ChatInput)
      const displayError = error && !error.includes('Failed to transcribe audio') && !error.includes('Transcription failed');
      if (displayError) return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--color-error)', fontFamily:'DM Sans,sans-serif' }}>
          Error: {error}
        </div>
      );

  /* ── TTS button label ── */
  const ttsLabel = ttsMode === 'off' ? 'TTS Off' : ttsMode === 'manual' ? 'Manual' : 'Auto';
  const ttsIcon  = ttsMode === 'off' ? '🔇' : '🔊';

   /* ── Render ── */
   return (
     <div className="chat-root">

       {/* ── Sidebar ── */}
        <aside className={`sidebar${showSidebar ? '' : ' hidden'}`}>
         <div className="sidebar-header">
           <div className="sidebar-header-top">
             <span className="sidebar-title">Conversations</span>
             <button className="icon-btn" onClick={() => setShowSidebar(false)} title="Close sidebar">
               ✕
             </button>
           </div>
           <input
             className="sidebar-search"
             type="text"
             placeholder="Search sessions…"
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
         </div>

         <button className="btn-new-chat" onClick={handleNewSession} disabled={isLoading || isStreaming}>
           <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
           New conversation
         </button>

          <div className="sessions-list">
            {loadingSessions ? (
              <div className="sessions-empty">Loading…</div>
            ) : filteredSessions.length === 0 ? (
              <div className="sessions-empty">
                <div className="sessions-empty-icon">{searchTerm ? '🔍' : '💬'}</div>
                <div className="sessions-empty-title">
                  {searchTerm ? 'No results' : 'No conversations yet'}
                </div>
                <div className="sessions-empty-sub">
                  {searchTerm
                    ? 'Try a different search term'
                    : 'Start a new conversation to begin'}
                </div>
              </div>
            ) : filteredSessions.map(s => (
              <div
                key={s.session_id}
                className={`session-item${currentSessionId === s.session_id ? ' active' : ''}`}
                onClick={() => switchToSession(s.session_id)}
              >
               <div className="session-item-content">
                 <div className="session-item-title">Session #{s.session_id}</div>
             <div className="session-item-meta">
               <span>{s.started_at ? new Date(s.started_at).toLocaleDateString() : '–'}</span>
               <span>·</span>
               <span>{s.message_count} msgs</span>
             </div>
           </div>
               <button
                 className="session-delete-btn"
                 onClick={(e) => handleDeleteSession(s.session_id, e)}
                 title="Delete conversation"
                 disabled={isLoading || isStreaming}
               >
                 ✕
               </button>
             </div>
           ))}
         </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-panel">

        {/* ── Topbar ── */}
        <header className="topbar">
          <button
            className={`icon-btn${showSidebar ? ' active' : ''}`}
            onClick={() => setShowSidebar(v => !v)}
            title="Toggle sidebar"
          >
            ☰
          </button>

          <span className="topbar-title">
            {currentSessionId ? `Session #${currentSessionId}` : 'New conversation'}
          </span>

          <button
            className={`icon-btn${showSearch ? ' active' : ''}`}
            onClick={toggleSearch}
            title="Search messages"
          >
            🔍
          </button>


        </header>

        {/* ── Search bar ── */}
        {showSearch && (
          <div className="search-bar">
            <input
              className="search-input"
              type="text"
              autoFocus
              placeholder="Search messages…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button className="search-close-btn" onClick={toggleSearch}>Close</button>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="messages-area">
          <div className="messages-inner">

            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-logo">✦</div>
                <div className="empty-state-heading">
                  Hello{user?.username ? `, ${user.username}` : ''}
                </div>
                <div className="empty-state-sub">
                  Ask me anything — from complex code problems to creative brainstorming.
                </div>
                <div className="suggestion-chips">
                  {[
                    '💡 Explain a concept',
                    '🛠️ Debug my code',
                    '✍️ Help me write',
                    '📊 Analyze data',
                  ].map(s => (
                    <button
                      key={s}
                      className="suggestion-chip"
                      onClick={() => { setInput(s.slice(3)); inputRef.current?.focus(); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`message-row ${msg.role}`}
                onMouseEnter={() => setHoveredMessage(idx)}
                onMouseLeave={() => setHoveredMessage(null)}
              >
                {/* hover toolbar */}
                {hoveredMessage === idx && (
                  <div className="hover-toolbar">
                    {['👍','❤️','😂','😮'].map(emoji => (
                      <button key={emoji} className="emoji-btn" onClick={() => addReaction(idx, emoji)} title={`React ${emoji}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* reaction badge */}
                {messageReactions[idx] && (
                  <div className="reaction-badge" onClick={() => addReaction(idx, messageReactions[idx])} title="Click to remove">
                    {messageReactions[idx]}
                  </div>
                )}

                {/* bubble */}
                <div
                  className="message-bubble"
                  onClick={() => copyMessage(msg.content, idx)}
                  title="Click to copy"
                >
                  {copiedMessage === idx && <div className="copy-toast">Copied ✓</div>}

                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p>{children}</p>,
                          ul: ({ children }) => <ul>{children}</ul>,
                          ol: ({ children }) => <ol>{children}</ol>,
                          li: ({ children }) => <li>{children}</li>,
                          code: ({ inline, children }: any) =>
                            inline
                              ? <code>{children}</code>
                              : <pre><code>{children}</code></pre>,
                          blockquote: ({ children }: any) => <blockquote>{children}</blockquote>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                    <span dangerouslySetInnerHTML={{ __html: highlightText(msg.content) }} />
                  )}
                </div>

                 {/* meta row */}
                <div className="message-meta">
                  <span>{msg.time ? formatTime(msg.time) : ''}</span>
                  {msg.role === 'user' && <span style={{ color: 'var(--accent)' }}>✓✓</span>}
                  {msg.role === 'assistant' && ttsMode !== 'off' && renderTtsButton(idx)}
                </div>
              </div>
            ))}

            {/* typing indicator – show during initial LLM latency (before any text arrives) */}
            { (isLoading && !isStreaming) || (isStreaming && !currentText) ? (
              <div className="typing-indicator">
                <div className="typing-dots">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            ) : null }

            {/* streaming */}
            {isStreaming && currentText && (
              <div className="message-row assistant">
                <div className="streaming-bubble">{currentText}</div>
              </div>
            )}
          </div>
        </div>

         {/* ── Input bar ── */}
         <div className="input-bar">
           <div className="input-bar-inner">
             <div className="selector-group">

               {/* Provider Dropdown */}
                <select
                 className="glass-select"
                  value={selectedProvider}
                  onChange={(e) => {
                    const provider = e.target.value as 'kilo_code' | 'ollama';
                    setSelectedProvider(provider);
                    const store = useLLMStore.getState();
                    // Ensure kilo models are refreshed when selecting kilo_code
                    if (provider === 'kilo_code') {
                      // Fire-and-forget refresh (will populate store.kiloModels)
                      store.refreshKiloModels(false).catch(() => {});
                    }
                    const models = store.getModelsForProvider(provider as any) || [];
                    if (models && models.length > 0) {
                      setSelectedModel(models[0].value);
                    }
                  }}
                >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                {opt.label}
                </option>
              ))}
              </select>

              {/* Model Dropdown */}
               <select
                 className="glass-select"
                 value={selectedModel}
                 onChange={(e) => setSelectedModel(e.target.value)}
               >
                {(useLLMStore().getModelsForProvider(selectedProvider) || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                   </option>
                ))}
               </select>

             </div>

             <textarea
               ref={inputRef}
               className="chat-input"
               rows={1}
               value={input}
               onChange={handleInputChange}
               onKeyDown={handleKeyDown}
               placeholder={isStreaming ? "Generating... (click stop to cancel)" : "Message…"}
               disabled={isLoading || isStreaming}
             />
                   {/* Mic Button */}
               <button
                className={`mic-btn ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
                title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Voice Input"}
                onClick={handleMicToggle}
                disabled={isTranscribing || isLoading || isStreaming}
               >
                {isTranscribing ? '⏳' : isRecording ? '⏹️' : '🎙️'}
               </button>
             <button
               className={`tts-btn ${ttsMode}`}
               type="button"
               onClick={handleTtsToggle}
               disabled={isLoading || isStreaming}
               title={`TTS: ${ttsLabel}`}
             >
               <span>{ttsIcon}</span>
               <span>{ttsLabel}</span>
             </button>
             {isStreaming ? (
               <button
                 className="send-btn"
                 onClick={handleStop}
                 title="Stop generation"
                 style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
               >
                 ■
               </button>
             ) : (
               <button
                 className="send-btn"
                 onClick={handleSubmit}
                 disabled={!input.trim() || isLoading || isStreaming}
                 title="Send message"
               >
                 ➤
               </button>
             )}
           </div>
         </div>

      </div>
    </div>
  );
}
