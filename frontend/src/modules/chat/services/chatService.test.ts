import { 
  sendMessage, 
  createSession, 
  getSessionHistory, 
  deleteSession,
  streamMessage
} from './chatService';
import apiClient from '@/core/api/client';

// Mock the apiClient
jest.mock('@/core/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const mockSession = { id: 'session-1', title: 'Test Session', createdAt: new Date().toISOString() };
      (mockApiClient.post as jest.MockedFunction<any>).mockResolvedValue({ data: mockSession });

      const result = await createSession();

      expect(mockApiClient.post).toHaveBeenCalledWith('/chat/sessions');
      expect(result).toEqual(mockSession);
    });

    it('should handle errors when creating session', async () => {
      const errorMessage = 'Failed to create session';
      (mockApiClient.post as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(createSession()).rejects.toThrow(errorMessage);
    });
  });

  describe('sendMessage', () => {
    it('should send a message and return response', async () => {
      const mockRequest = { sessionId: 'session-1', message: 'Hello', emotion: 'neutral' };
      const mockResponse = { id: 'msg-1', content: 'Hi there!', timestamp: new Date().toISOString() };
      (mockApiClient.post as jest.MockedFunction<any>).mockResolvedValue({ data: mockResponse });

      const result = await sendMessage(mockRequest);

      expect(mockApiClient.post).toHaveBeenCalledWith('/chat/messages', mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when sending message', async () => {
      const mockRequest = { sessionId: 'session-1', message: 'Hello', emotion: 'neutral' };
      const errorMessage = 'Failed to send message';
      (mockApiClient.post as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(sendMessage(mockRequest)).rejects.toThrow(errorMessage);
    });
  });

  describe('getSessionHistory', () => {
    it('should fetch session history', async () => {
      const sessionId = 'session-1';
      const mockHistory = [
        { id: 'msg-1', content: 'Hello', sender: 'user', timestamp: new Date().toISOString() },
        { id: 'msg-2', content: 'Hi there!', sender: 'assistant', timestamp: new Date().toISOString() }
      ];
      (mockApiClient.get as jest.MockedFunction<any>).mockResolvedValue({ data: mockHistory });

      const result = await getSessionHistory(sessionId);

      expect(mockApiClient.get).toHaveBeenCalledWith(`/chat/sessions/${sessionId}/messages`);
      expect(result).toEqual(mockHistory);
    });

    it('should handle errors when fetching session history', async () => {
      const sessionId = 'session-1';
      const errorMessage = 'Failed to fetch session history';
      (mockApiClient.get as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(getSessionHistory(sessionId)).rejects.toThrow(errorMessage);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const sessionId = 'session-1';
      (mockApiClient.delete as jest.MockedFunction<any>).mockResolvedValue({});

      await deleteSession(sessionId);

      expect(mockApiClient.delete).toHaveBeenCalledWith(`/chat/sessions/${sessionId}`);
    });

    it('should handle errors when deleting session', async () => {
      const sessionId = 'session-1';
      const errorMessage = 'Failed to delete session';
      (mockApiClient.delete as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(deleteSession(sessionId)).rejects.toThrow(errorMessage);
    });
  });

  describe('streamMessage', () => {
    it('should stream a message response', async () => {
      // Mock fetch to simulate streaming response
      const mockReadableStream = {
        getReader: jest.fn(),
      };

      const mockResponse = {
        body: mockReadableStream,
        ok: true,
        status: 200,
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const mockRequest = { sessionId: 'session-1', message: 'Hello', emotion: 'neutral' };
      
      // Since streamMessage returns an AsyncGenerator, we'll just test that fetch is called correctly
      const generator = streamMessage(mockRequest);
      
      // We can't easily test the full streaming behavior in Jest, but we can ensure fetch is called
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.REACT_APP_API_BASE_URL || '/api'}/chat/stream`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(mockRequest),
        })
      );
    });

    it('should throw error for non-OK response', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };

      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const mockRequest = { sessionId: 'session-1', message: 'Hello', emotion: 'neutral' };
      
      const generator = streamMessage(mockRequest);
      const iterator = generator[Symbol.asyncIterator]();
      
      await expect(iterator.next()).rejects.toThrow('HTTP error! status: 500');
    });
  });
});