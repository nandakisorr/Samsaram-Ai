import { getAllSessions, getSessionById, deleteSession } from './historyService';
import apiClient from '@/core/api/client';

// Mock the apiClient
jest.mock('@/core/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('historyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllSessions', () => {
    it('should return all sessions', async () => {
      const mockSessions = [
        { id: 'session-1', title: 'First Conversation', createdAt: '2023-01-01T00:00:00Z', lastMessageAt: '2023-01-01T01:00:00Z' },
        { id: 'session-2', title: 'Second Conversation', createdAt: '2023-01-02T00:00:00Z', lastMessageAt: '2023-01-02T02:00:00Z' },
        { id: 'session-3', title: 'Third Conversation', createdAt: '2023-01-03T00:00:00Z', lastMessageAt: '2023-01-03T03:00:00Z' }
      ];
      (mockApiClient.get as jest.MockedFunction<any>).mockResolvedValue({ data: mockSessions });

      const result = await getAllSessions();

      expect(mockApiClient.get).toHaveBeenCalledWith('/history/sessions');
      expect(result).toEqual(mockSessions);
    });

    it('should handle errors when fetching all sessions', async () => {
      const errorMessage = 'Failed to fetch sessions';
      (mockApiClient.get as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(getAllSessions()).rejects.toThrow(errorMessage);
    });

    it('should return empty array when no sessions exist', async () => {
      (mockApiClient.get as jest.MockedFunction<any>).mockResolvedValue({ data: [] });

      const result = await getAllSessions();

      expect(mockApiClient.get).toHaveBeenCalledWith('/history/sessions');
      expect(result).toEqual([]);
    });
  });

  describe('getSessionById', () => {
    it('should return session by ID', async () => {
      const sessionId = 'session-1';
      const mockSession = { 
        id: 'session-1', 
        title: 'Test Conversation', 
        createdAt: '2023-01-01T00:00:00Z', 
        lastMessageAt: '2023-01-01T01:00:00Z',
        messages: [
          { id: 'msg-1', content: 'Hello', sender: 'user', timestamp: '2023-01-01T00:30:00Z' },
          { id: 'msg-2', content: 'Hi there!', sender: 'assistant', timestamp: '2023-01-01T00:31:00Z' }
        ]
      };
      (mockApiClient.get as jest.MockedFunction<any>).mockResolvedValue({ data: mockSession });

      const result = await getSessionById(sessionId);

      expect(mockApiClient.get).toHaveBeenCalledWith(`/history/sessions/${sessionId}`);
      expect(result).toEqual(mockSession);
    });

    it('should handle errors when fetching session by ID', async () => {
      const sessionId = 'non-existent-session';
      const errorMessage = 'Session not found';
      (mockApiClient.get as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(getSessionById(sessionId)).rejects.toThrow(errorMessage);
    });

    it('should handle invalid session ID', async () => {
      const sessionId = '';
      const errorMessage = 'Invalid session ID';
      (mockApiClient.get as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(getSessionById(sessionId)).rejects.toThrow(errorMessage);
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      const sessionId = 'session-1';
      (mockApiClient.delete as jest.MockedFunction<any>).mockResolvedValue({});

      await deleteSession(sessionId);

      expect(mockApiClient.delete).toHaveBeenCalledWith(`/history/sessions/${sessionId}`);
    });

    it('should handle errors when deleting session', async () => {
      const sessionId = 'non-existent-session';
      const errorMessage = 'Session not found';
      (mockApiClient.delete as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(deleteSession(sessionId)).rejects.toThrow(errorMessage);
    });

    it('should handle invalid session ID', async () => {
      const sessionId = '';
      const errorMessage = 'Invalid session ID';
      (mockApiClient.delete as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(deleteSession(sessionId)).rejects.toThrow(errorMessage);
    });
  });
});