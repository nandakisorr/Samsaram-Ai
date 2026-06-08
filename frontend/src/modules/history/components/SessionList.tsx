import { useState, useMemo } from 'react';
import type { SessionSummary } from '../types';
import type { ChatMessage } from '@/core/types';
import styles from './SessionList.module.css';

// SVG Icons
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const HashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const MessageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

interface SessionListProps {
  sessions: SessionSummary[];
  selectedId?: number;
  onSelect: (sessionId: number) => void;
  onDelete?: (sessionId: number) => void;
  isLoading?: boolean;
}

export function SessionList({
  sessions,
  selectedId,
  onSelect,
  onDelete,
  isLoading = false,
}: SessionListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions;
    const term = searchTerm.toLowerCase();
    return sessions.filter(s =>
      s.session_id.toString().includes(term) ||
      s.messages.some((m: ChatMessage) => m.content.toLowerCase().includes(term))
    );
  }, [sessions, searchTerm]);

  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    });
  }, [filteredSessions]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today, ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday, ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getPreview = (session: SessionSummary) => {
    const lastUserMsg = [...session.messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      const content = lastUserMsg.content.trim();
      if (!content) return 'Empty message';
      // Truncate at word boundary
      if (content.length <= 100) return content;
      const truncated = content.slice(0, 100);
      const lastSpace = truncated.lastIndexOf(' ');
      return lastSpace > 50 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
    }
    return 'No user messages';
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.emptyIcon}>
          <MessageIcon />
        </div>
        <span>Loading sessions...</span>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <MessageIcon />
        </div>
        <span className={styles.emptyText}>No chat sessions yet</span>
        <span className={styles.emptySubtext}>Start a conversation to see it here</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h3 className={styles.title}>
            <span className={styles.titleIconWrapper}>
              <HashIcon />
            </span>
            Chat History
          </h3>
          <span className={styles.sessionCount}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>
            <SearchIcon />
          </span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className={styles.clearBtn} onClick={() => setSearchTerm('')}>
              <XIcon />
            </button>
          )}
        </div>
      </div>

      <div className={styles.list}>
        {sortedSessions.map((session) => (
          <div
            key={session.session_id}
            className={`${styles.sessionCard} ${selectedId === session.session_id ? styles.selected : ''}`}
            onClick={() => onSelect(session.session_id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(session.session_id)}
          >
            <div className={styles.sessionCardHeader}>
              <div className={styles.sessionInfo}>
                <div className={styles.sessionIdRow}>
                  <span className={styles.sessionId}>
                    <HashIcon />
                    Session #{session.session_id}
                  </span>
                  <span className={styles.messageCount}>
                    {session.message_count} {session.message_count === 1 ? 'message' : 'messages'}
                  </span>
                </div>
                <div className={styles.sessionPreview}>{getPreview(session)}</div>
                <div className={styles.sessionMeta}>
                  <span className={styles.metaItem}>
                    <ClockIcon />
                    {formatDate(session.started_at)}
                  </span>
                  <span className={styles.metaItem}>
                    <MessageIcon />
                    {session.message_count} messages
                  </span>
                </div>
              </div>
              {onDelete && (
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(session.session_id);
                  }}
                  title="Delete session"
                  aria-label={`Delete session ${session.session_id}`}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
