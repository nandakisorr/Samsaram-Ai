import apiClient from '@/core/api/client';
import { SessionSummary, SessionDetail, DeleteResponse } from '@/core/types';

export const historyService = {
  /**
   * Get all chat sessions with summary
   */
  async getSessions(): Promise<SessionSummary[]> {
    console.log('historyService.getSessions: fetching');
    try {
      const data = await apiClient.handleResponse(
        apiClient.get<SessionSummary[]>('/api/v1/chat/history')
      );
      console.log('historyService.getSessions: success', data);
      return data;
    } catch (error: any) {
      console.error('historyService.getSessions: error', error);
      throw error;
    }
  },

  /**
   * Get single session with all messages
   */
  async getSession(sessionId: number): Promise<SessionDetail> {
    return await apiClient.handleResponse(
      apiClient.get<SessionDetail>(`/api/v1/chat/history/${sessionId}`)
    );
  },

  /**
   * Delete a session
   */
  async deleteSession(sessionId: number): Promise<DeleteResponse> {
    return await apiClient.handleResponse(
      apiClient.delete<DeleteResponse>(`/api/v1/chat/history/${sessionId}`)
    );
  },

  /**
   * Export session as plain text
   */
  async exportSession(sessionId: number): Promise<string> {
    const session = await this.getSession(sessionId);
    const lines: string[] = [];

    lines.push(`Session #${session.session_id}`);
    lines.push(`Started: ${session.started_at}`);
    lines.push('='.repeat(50));
    lines.push('');

    for (const msg of session.messages) {
      const role = msg.role === 'user' ? 'You' : 'Assistant';
      const time = new Date(`1970-01-01 ${msg.time}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      lines.push(`[${time}] ${role}:`);
      lines.push(msg.content);
      lines.push('');
    }

    return lines.join('\n');
  },

  /**
   * Export session as JSON
   */
  async exportSessionJSON(sessionId: number): Promise<SessionDetail> {
    return await this.getSession(sessionId);
  },
};

export default historyService;
