import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';
import * as chatService from '../services/chatService';

// Mock the chat service
jest.mock('../services/chatService', () => ({
  sendMessage: jest.fn(),
  createSession: jest.fn(),
  getSessionHistory: jest.fn(),
  deleteSession: jest.fn(),
  streamMessage: jest.fn(),
}));

// Mock console.error to avoid noise during tests
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('useChat', () => {
  const mockSessionId = 'session-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful session creation
    (chatService.createSession as jest.MockedFunction<any>).mockResolvedValue({
      id: mockSessionId,
      title: 'Test Session',
      createdAt: new Date().toISOString(),
    });
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.sessionId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('creates a new session successfully', async () => {
    (chatService.createSession as jest.MockedFunction<any>).mockResolvedValue({
      id: mockSessionId,
      title: 'New Session',
      createdAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.createSession();
    });

    expect(chatService.createSession).toHaveBeenCalledTimes(1);
    expect(result.current.sessionId).toBe(mockSessionId);
    expect(result.current.isLoading).toBe(false);
  });

  it('handles session creation error', async () => {
    const errorMessage = 'Failed to create session';
    (chatService.createSession as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await expect(result.current.createSession()).rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
  });

  it('sends a message successfully', async () => {
    const mockMessage = 'Hello, world!';
    const mockResponse = {
      id: 'msg-1',
      content: 'Hi there!',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
    };

    (chatService.sendMessage as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useChat());

    // First create a session
    await act(async () => {
      await result.current.createSession();
    });

    // Then send a message
    await act(async () => {
      await result.current.sendMessage(mockMessage, 'neutral');
    });

    expect(chatService.sendMessage).toHaveBeenCalledWith({
      sessionId: mockSessionId,
      message: mockMessage,
      emotion: 'neutral',
    });
    expect(result.current.messages).toHaveLength(2); // User message + Assistant response
    expect(result.current.isLoading).toBe(false);
  });

  it('handles message sending error', async () => {
    const mockMessage = 'Hello, world!';
    const errorMessage = 'Failed to send message';
    
    (chatService.sendMessage as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useChat());

    // First create a session
    await act(async () => {
      await result.current.createSession();
    });

    // Then try to send a message
    await act(async () => {
      await expect(result.current.sendMessage(mockMessage, 'neutral')).rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
  });

  it('loads session history successfully', async () => {
    const mockHistory = [
      { id: 'msg-1', content: 'Previous message', sender: 'user', timestamp: new Date().toISOString() },
      { id: 'msg-2', content: 'Previous response', sender: 'assistant', timestamp: new Date().toISOString() },
    ];

    (chatService.getSessionHistory as jest.MockedFunction<any>).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadSessionHistory(mockSessionId);
    });

    expect(chatService.getSessionHistory).toHaveBeenCalledWith(mockSessionId);
    expect(result.current.messages).toEqual(mockHistory);
    expect(result.current.isLoading).toBe(false);
  });

  it('handles loading session history error', async () => {
    const errorMessage = 'Failed to load history';
    (chatService.getSessionHistory as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await expect(result.current.loadSessionHistory(mockSessionId)).rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
  });

  it('clears error when performing new action', async () => {
    const errorMessage = 'Some error';
    (chatService.createSession as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useChat());

    // Cause an error
    await act(async () => {
      await expect(result.current.createSession()).rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);

    // Clear error by mocking success
    (chatService.createSession as jest.MockedFunction<any>).mockResolvedValue({
      id: mockSessionId,
      title: 'New Session',
      createdAt: new Date().toISOString(),
    });

    // Perform another action
    await act(async () => {
      await result.current.createSession();
    });

    expect(result.current.error).toBeNull();
  });

  it('maintains loading state during operations', async () => {
    // Make the API call take some time to verify loading state
    (chatService.createSession as jest.MockedFunction<any>).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        id: mockSessionId,
        title: 'New Session',
        createdAt: new Date().toISOString(),
      }), 10))
    );

    const { result } = renderHook(() => useChat());

    // Start the async operation
    const promise = act(async () => {
      await result.current.createSession();
    });

    // Check that loading is true immediately
    expect(result.current.isLoading).toBe(true);

    // Wait for the operation to complete
    await promise;

    // Check that loading is false after completion
    expect(result.current.isLoading).toBe(false);
    expect(result.current.sessionId).toBe(mockSessionId);
  });

  it('adds user message to state immediately before API call', async () => {
    const mockMessage = 'Hello, world!';
    const mockResponse = {
      id: 'msg-1',
      content: 'Hi there!',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
    };

    (chatService.sendMessage as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useChat());

    // First create a session
    await act(async () => {
      await result.current.createSession();
    });

    // Send a message
    await act(async () => {
      await result.current.sendMessage(mockMessage, 'neutral');
    });

    // Should have both user message and assistant response
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe(mockMessage);
    expect(result.current.messages[0].sender).toBe('user');
    expect(result.current.messages[1].content).toBe(mockResponse.content);
    expect(result.current.messages[1].sender).toBe('assistant');
  });

  it('resets state correctly', async () => {
    const mockHistory = [
      { id: 'msg-1', content: 'Previous message', sender: 'user', timestamp: new Date().toISOString() },
    ];

    (chatService.getSessionHistory as jest.MockedFunction<any>).mockResolvedValue(mockHistory);
    (chatService.createSession as jest.MockedFunction<any>).mockResolvedValue({
      id: mockSessionId,
      title: 'New Session',
      createdAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useChat());

    // Load some data
    await act(async () => {
      await result.current.createSession();
      await result.current.loadSessionHistory(mockSessionId);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.sessionId).toBe(mockSessionId);

    // Reset the state
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.error).toBeNull();
  });
});