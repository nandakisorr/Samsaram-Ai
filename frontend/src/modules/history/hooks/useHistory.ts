import { useState, useCallback } from 'react';
import type { SessionSummary, SessionDetail } from '../types';
import historyService from '../services/historyService';

type ExportFormat = 'txt' | 'json';

export function useHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all sessions
  const fetchSessions = useCallback(async () => {
    console.log('useHistory: fetchSessions called');
    setIsLoading(true);
    setError(null);

    try {
      const data = await historyService.getSessions();
      console.log('useHistory: fetchSessions success, sessions:', data);
      setSessions(data);
    } catch (err: any) {
      console.error('useHistory: fetchSessions error', err);
      setError(err.detail || err.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch single session
  const fetchSession = useCallback(async (sessionId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await historyService.getSession(sessionId);
      setCurrentSession(data);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: number) => {
    try {
      await historyService.deleteSession(sessionId);
      // Remove from list
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      // Clear current if it was deleted
      if (currentSession?.session_id === sessionId) {
        setCurrentSession(null);
      }
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to delete session');
      throw err;
    }
  }, [currentSession]);

  // Clear current session
  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  // Export session
  const exportSession = useCallback(async (
    sessionId: number,
    format: ExportFormat = 'txt'
  ): Promise<string | SessionDetail> => {
    if (format === 'txt') {
      return await historyService.exportSession(sessionId);
    } else {
      return await historyService.exportSessionJSON(sessionId);
    }
  }, []);

  // Download export as file
  const downloadExport = useCallback(async (
    sessionId: number,
    format: ExportFormat = 'txt'
  ) => {
    try {
      const data = await exportSession(sessionId, format);
      const content = format === 'txt' ? data as string : JSON.stringify(data, null, 2);
      const filename = `session-${sessionId}-export.${format}`;
      const blob = new Blob([content], { type: format === 'txt' ? 'text/plain' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to export session');
      throw err;
    }
  }, [exportSession]);

  return {
    sessions,
    currentSession,
    isLoading,
    error,
    fetchSessions,
    fetchSession,
    deleteSession,
    clearCurrentSession,
    exportSession,
    downloadExport,
  };
}

export default useHistory;
