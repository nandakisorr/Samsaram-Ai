import { useEffect, useState, useMemo } from 'react';
import { SessionView } from '@/modules/history';
import { useHistory } from '@/modules/history';
import styles from '@/modules/history/components/SessionList.module.css';

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
type ExportFormat = 'txt' | 'json';

/* ─────────────────────────────────────────
   Global CSS (injected once, matches ChatPage light theme)
   ───────────────────────────────────────── */
const HISTORY_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

   /* ── Design tokens ── */
   :root {
     --bg: var(--color-bg-primary);
     --surface: var(--color-bg-secondary);
     --surface-2: var(--color-bg-tertiary);
     --surface-3: var(--color-bg-hover);
     --border: var(--color-border);
     --border-2: var(--color-border-hover);
     --accent: var(--color-accent);
     --accent-2: var(--color-accent-hover);
     --accent-glow: var(--color-accent-light);
     --text-1: var(--color-text-primary);
     --text-2: var(--color-text-secondary);
     --text-3: var(--color-text-muted);
     --danger: var(--color-error);
     --radius-sm: 6px;
     --radius-md: 12px;
     --radius-lg: 18px;
     --shadow-sm: var(--shadow-sm);
     --shadow-lg: var(--shadow-lg);
     --transition: 0.2s cubic-bezier(0.4,0,0.2,1);
     --font: 'DM Sans', sans-serif;
   }

  .history-root {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text-1);
    height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Page header ── */
  .history-header {
    height: 56px;
    padding: 0 24px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .history-header-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--accent-glow);
    border: 1px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
  }
  .history-header-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }
  .history-header-sub {
    font-size: 12px;
    color: var(--text-3);
    margin-left: auto;
  }

  /* ── Body layout ── */
  .history-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  /* ── Sidebar ── */
  .history-sidebar {
    width: 280px;
    min-width: 280px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .history-sidebar-header {
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .history-sidebar-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 10px;
    display: block;
  }
  .history-search {
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    font-family: inherit;
    font-size: 13px;
    color: var(--text-1);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .history-search::placeholder { color: var(--text-3); }
  .history-search:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  /* ── Sessions list ── */
  .history-sessions-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--surface-3) transparent;
  }
  .history-sessions-list::-webkit-scrollbar { width: 4px; }
  .history-sessions-list::-webkit-scrollbar-track { background: transparent; }
  .history-sessions-list::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 2px; }

  .history-session-card {
    padding: 11px 13px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-bottom: 3px;
    border: 1px solid transparent;
    position: relative;
  }
  .history-session-card:hover {
    background: var(--surface-3);
    border-color: var(--border);
  }
  .history-session-card.active {
    background: var(--accent-glow);
    border-color: var(--accent);
  }
  .history-session-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .history-session-id {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }
  .history-session-card.active .history-session-id { color: var(--accent); }
  .history-session-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 99px;
    background: var(--surface-2);
    color: var(--text-3);
    letter-spacing: 0.02em;
  }
  .history-session-card.active .history-session-badge {
    background: var(--accent-glow);
    color: var(--accent);
  }
  .history-session-preview {
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.4;
    margin: 4px 0 6px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .history-session-meta {
    font-size: 11px;
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .history-session-dot { opacity: 0.4; }
  .history-session-card.active .history-session-badge {
    background: var(--accent-glow);
    color: var(--accent);
  }

  .history-session-delete {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  .history-session-card:hover .history-session-delete { display: flex; }
  .history-session-delete:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
  }

  .history-empty-list {
    padding: 32px 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .history-empty-list-icon {
    font-size: 28px;
    opacity: 0.4;
    margin-bottom: 4px;
  }
  .history-empty-list-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
  }
  .history-empty-list-sub {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.5;
  }

  /* ── Loading skeleton ── */
  .skeleton {
    background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface) 50%, var(--surface-2) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 4px;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .skeleton-card {
    padding: 11px 13px;
    margin-bottom: 3px;
    border-radius: 8px;
  }
  .skeleton-line {
    height: 12px;
    margin-bottom: 6px;
  }
  .skeleton-line.short { width: 55%; }
  .skeleton-line.long  { width: 80%; }
  .skeleton-line.tiny  { width: 40%; height: 10px; margin-bottom: 0; }

  /* ── Main content ── */
  .history-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    background: var(--bg);
  }

  /* ── Empty state ── */
  .history-empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 48px 32px;
    text-align: center;
    animation: fadeIn 0.3s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .history-empty-orb {
    width: 72px;
    height: 72px;
    border-radius: 22px;
    background: var(--accent-glow);
    border: 1px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    box-shadow: var(--shadow-sm);
    margin-bottom: 4px;
  }
  .history-empty-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }
  .history-empty-desc {
    font-size: 14px;
    color: var(--text-2);
    max-width: 300px;
    line-height: 1.6;
  }
  .history-empty-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-3);
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 7px 14px;
    border-radius: 99px;
    margin-top: 4px;
    box-shadow: var(--shadow-sm);
  }

  /* ── Session view ── */
  .history-session-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: fadeIn 0.25s ease;
  }

  .session-topbar {
    height: 52px;
    padding: 0 20px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .session-back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--accent);
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .session-back-btn:hover {
    background: var(--accent-glow);
    border-color: var(--accent);
  }
  .session-topbar-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  .session-topbar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .session-topbar-meta {
    font-size: 11px;
    color: var(--text-3);
  }
  .session-delete-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-3);
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .session-delete-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
    border-color: rgba(239, 68, 68, 0.2);
  }

  /* ── Error state ── */
  .history-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px;
    text-align: center;
  }
  .history-error-orb {
    width: 64px;
    height: 64px;
    border-radius: 20px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--danger);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
  }
  .history-error-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--danger);
  }
  .history-error-msg {
    font-size: 13px;
    color: var(--text-2);
    max-width: 320px;
    line-height: 1.6;
  }

  /* ── Export FAB ── */
  .export-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 6px 6px 6px 8px;
    box-shadow: var(--shadow-lg);
    animation: slideUp 0.25s ease;
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .export-select {
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    font-family: inherit;
    font-size: 13px;
    color: var(--text-1);
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s;
    appearance: none;
    -webkit-appearance: none;
    padding-right: 28px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
  }
  .export-select:focus { border-color: var(--accent); }

   .export-btn {
     display: flex;
     align-items: center;
     gap: 6px;
     padding: 7px 14px;
     border-radius: 8px;
     border: none;
     background: #2563eb;
     color: #ffffff !important;
     font-family: inherit;
     font-size: 14px;
     font-weight: 800;
     cursor: pointer;
     transition: all 0.2s ease;
     box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
     white-space: nowrap;
     position: relative;
     z-index: 2;
   }
  .export-btn:hover {
    opacity: 0.95;
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 6px 16px rgba(30, 64, 175, 0.6);
  }
  .export-btn:active {
    transform: translateY(0) scale(0.98);
  }
  .export-btn:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
  }
  .export-btn svg {
    stroke: #ffffff;
    position: relative;
    z-index: 1;
  }
`;

/* ─────────────────────────────────────────
   Sub-components
──────────────────────────────────────── */

function SkeletonList() {
  return (
    <>
      {[80, 65, 75, 60, 70].map((w, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-line short" />
          <div className={`skeleton skeleton-line`} style={{ width: `${w}%` }} />
          <div className="skeleton skeleton-line tiny" />
        </div>
      ))}
    </>
  );
}

interface SessionCardProps {
  session: { session_id: number; started_at: string; message_count: number; messages: Array<{role: string; content: string; time: string}> };
  isActive: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

function SessionCard({ session, isActive, onSelect, onDelete }: SessionCardProps) {
  const date = new Date(session.started_at);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Get last user message for preview
  const lastUserMsg = [...session.messages].reverse().find(m => m.role === 'user');
  const preview = lastUserMsg
    ? lastUserMsg.content.trim().slice(0, 100) + (lastUserMsg.content.length > 100 ? '...' : '')
    : 'No messages';

  return (
    <div
      className={`history-session-card${isActive ? ' active' : ''}`}
      onClick={() => onSelect(session.session_id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(session.session_id)}
    >
      <div className="history-session-card-top">
        <span className="history-session-id">Session #{session.session_id}</span>
        <span className="history-session-badge">{session.message_count} msg{session.message_count !== 1 ? 's' : ''}</span>
      </div>
      <div className="history-session-preview">{preview}</div>
      <div className="history-session-meta">
        <span>{dateStr}</span>
        <span className="history-session-dot">·</span>
        <span>{timeStr}</span>
      </div>
      <button
        className="history-session-delete"
        onClick={e => { e.stopPropagation(); onDelete(session.session_id); }}
        title="Delete session"
        aria-label="Delete session"
      >
        ✕
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────
   Main page
──────────────────────────────────────── */
function HistoryPage() {
  const {
    sessions,
    currentSession,
    isLoading,
    error,
    fetchSessions,
    fetchSession,
    deleteSession,
    clearCurrentSession,
    downloadExport,
  } = useHistory();

  const [exportFormat, setExportFormat] = useState<ExportFormat>('txt');
  const [searchTerm, setSearchTerm] = useState('');

  /* inject CSS once */
  useEffect(() => {
    const id = 'history-page-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = HISTORY_CSS;
      document.head.appendChild(el);
    }
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleSelectSession = (sessionId: number) => fetchSession(sessionId);

  const handleDeleteSession = async (sessionId: number) => {
    if (window.confirm('Delete this session? This cannot be undone.')) {
      await deleteSession(sessionId);
    }
  };

  const handleExport = async () => {
    if (!currentSession) return;
    try { await downloadExport(currentSession.session_id, exportFormat); }
    catch (err) { console.error('Export failed:', err); }
  };

  const filteredSessions = useMemo(() => {
    let result = sessions.filter(s =>
      searchTerm === '' ||
      String(s.session_id).includes(searchTerm) ||
      new Date(s.started_at).toLocaleDateString().includes(searchTerm)
    );
    // Sort by started_at descending (latest first)
    return result.sort((a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
  }, [sessions, searchTerm]);

  /* ── Error state ── */
  if (error) return (
    <div className="history-root">
      <div className="history-error">
        <div className="history-error-orb">⚠️</div>
        <div className="history-error-title">Something went wrong</div>
        <div className="history-error-msg">{error}</div>
      </div>
    </div>
  );

  return (
    <div className="history-root">

      {/* ── Page header ── */}
      <header className="history-header">
        <div className="history-header-icon">📋</div>
        <span className="history-header-title">Conversation History</span>
        <span className="history-header-sub">
          {sessions.length > 0 ? `${sessions.length} session${sessions.length !== 1 ? 's' : ''}` : ''}
        </span>
      </header>

      {/* ── Body ── */}
      <div className="history-body">

        {/* ── Sidebar ── */}
        <aside className="history-sidebar">
          <div className="history-sidebar-header">
            <span className="history-sidebar-label">Sessions</span>
            <input
              className="history-search"
              type="text"
              placeholder="Search by ID or date…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="history-sessions-list">
            {isLoading ? (
              <SkeletonList />
            ) : filteredSessions.length === 0 ? (
              <div className="history-empty-list">
                <div className="history-empty-list-icon">
                  {searchTerm ? '🔍' : '💬'}
                </div>
                <div className="history-empty-list-title">
                  {searchTerm ? 'No results' : 'No sessions yet'}
                </div>
                <div className="history-empty-list-sub">
                  {searchTerm
                    ? 'Try a different search term'
                    : 'Your conversations will appear here once you start chatting'}
                </div>
              </div>
            ) : (
              filteredSessions.map(s => (
                <SessionCard
                  key={s.session_id}
                  session={s}
                  isActive={currentSession?.session_id === s.session_id}
                  onSelect={handleSelectSession}
                  onDelete={handleDeleteSession}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="history-main">
          {currentSession ? (
            <div className="history-session-view">
              {/* Inline topbar over SessionView */}
              <div className="session-topbar">
                <button className="session-back-btn" onClick={clearCurrentSession}>
                  ← Back
                </button>
                <div className="session-topbar-info">
                  <span className="session-topbar-title">Session #{currentSession.session_id}</span>
                  <span className="session-topbar-meta">
                    {new Date(currentSession.started_at).toLocaleDateString(undefined, {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                    {' · '}
                    {currentSession.messages.length} message{currentSession.messages.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  className="session-delete-btn"
                  onClick={() => handleDeleteSession(currentSession.session_id)}
                >
                  🗑 Delete
                </button>
              </div>

              {/* Delegate message rendering to existing SessionView */}
              <SessionView
                messages={currentSession.messages}
                sessionInfo={{
                  session_id: currentSession.session_id,
                  started_at: currentSession.started_at,
                  message_count: currentSession.messages.length,
                }}
                onBack={clearCurrentSession}
                onDelete={() => handleDeleteSession(currentSession.session_id)}
                onExport={handleExport}
              />
            </div>
          ) : (
            <div className="history-empty-state">
              <div className="history-empty-orb">📚</div>
              <div className="history-empty-title">No Session Selected</div>
              <div className="history-empty-desc">
                Choose a conversation from the sidebar to browse its messages and export them.
              </div>
              <div className="history-empty-hint">
                <span>←</span>
                <span>Select a session from the left panel</span>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Export FAB ── */}
      {currentSession && (
        <div
          className="export-fab"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '6px 6px 6px 8px',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <select
            className="export-select"
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value as ExportFormat)}
            aria-label="Export format"
          >
            <option value="txt">Plain Text (.txt)</option>
            <option value="json">JSON (.json)</option>
          </select>
          <button
            className="export-btn"
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '0px solid #000000',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              whiteSpace: 'nowrap',
              position: 'relative' as const,
              zIndex: 2,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 4v12" />
            </svg>
            Download
          </button>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
