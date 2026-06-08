import type { SessionSummary, SessionDetail } from '@/core/types';
export type { SessionSummary, SessionDetail };

export interface HistoryState {
  sessions: SessionSummary[];
  currentSession: SessionDetail | null;
  isLoading: boolean;
  error: string | null;
}

export interface SessionListProps {
  sessions: SessionSummary[];
  selectedId?: number;
  onSelect: (sessionId: number) => void;
  onDelete?: (sessionId: number) => void;
  isLoading?: boolean;
}

export interface SessionViewProps {
  messages: SessionDetail['messages'];
  onBack?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  isLoading?: boolean;
  sessionInfo?: {
    session_id: number;
    started_at: string;
    message_count: number;
  };
}
