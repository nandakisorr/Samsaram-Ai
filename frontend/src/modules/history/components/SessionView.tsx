import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '../../chat/types';
import styles from './SessionView.module.css';

// SVG Icons
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3-4V3a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 4v12" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const HashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

interface SessionViewProps {
  messages: ChatMessageType[];
  onBack?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  sessionInfo?: { session_id: number; started_at: string; message_count: number };
}

export function SessionView({
  messages,
  onBack,
  onDelete,
  onExport,
  isLoading = false,
  sessionInfo
}: SessionViewProps) {
  const formatTime = (timeStr: string) => {
    return new Date(`1970-01-01 ${timeStr}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.emptyStateIcon}>
          <BotIcon />
        </div>
        <span>Loading session...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>


      {sessionInfo && (
        <div className={styles.infoBar}>
          <span className={styles.infoItem}>
            <CalendarIcon />
            {formatDate(sessionInfo.started_at)}
          </span>
          <span className={styles.infoItem}>
            <ClockIcon />
            {messages.length} messages
          </span>
        </div>
      )}

      <div className={styles.messages}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`${styles.message} ${styles[msg.role]}`}
          >
            <div className={styles.avatar}>
              {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
            </div>
            <div className={styles.content}>
              <div className={styles.header}>
                <span className={styles.role}>
                  {msg.role === 'user' ? (
                    <>
                      <UserIcon />
                      You
                    </>
                  ) : (
                    <>
                      <BotIcon />
                      Assistant
                    </>
                  )}
                </span>
                <span className={styles.time}>{formatTime(msg.time)}</span>
              </div>
              <div className={styles.text}>
                 {msg.role === 'assistant' ? (
                   <ReactMarkdown
                     rehypePlugins={[rehypeRaw]}
                     components={{
                      p: ({ children }) => <p style={{ margin: '0 0 0.5em' }}>{children}</p>,
                      ul: ({ children }) => <ul style={{ margin: '0.4em 0', paddingLeft: '1.4em' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ margin: '0.4em 0', paddingLeft: '1.4em' }}>{children}</ol>,
                      li: ({ children }) => <li style={{ margin: '0.2em 0' }}>{children}</li>,
                      code: ({ inline, children }: any) =>
                        inline ? (
                          <code style={{
                            fontFamily: 'DM Mono, monospace',
                            fontSize: '0.9em',
                            background: 'rgba(0,0,0,0.06)',
                            padding: '2px 5px',
                            borderRadius: '4px'
                          }}>{children}</code>
                        ) : (
                          <pre style={{
                            display: 'block',
                            background: '#f1f5f9',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            overflowX: 'auto',
                            margin: '0.5em 0',
                            border: '1px solid var(--border-color, #e2e8f0)'
                          }}>
                            <code>{children}</code>
                          </pre>
                        ),
                      blockquote: ({ children }: any) => (
                        <blockquote style={{
                          borderLeft: '3px solid var(--accent, #6366f1)',
                          paddingLeft: '12px',
                          margin: '0.6em 0',
                          opacity: 0.8,
                          fontStyle: 'italic'
                        }}>
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          </div>
         ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
