import { renderHook, act } from '@testing-library/react';
import { useHistory } from '../../hooks/useHistory';
import * as historyService from '../services/historyService';

// Mock the history service
jest.mock('../services/historyService', () => ({
  getAllSessions: jest.fn(),
  getSessionById: jest.fn(),
  deleteSession: jest.fn(),
}));

describe('useHistory', () => {
  const mockSessions = [
    {
      id: 'session-1',
      title: 'First Conversation',
      createdAt: '2023-01-01T00:00:00Z',
      lastMessageAt: '2023-01-01T01:00:00Z',
    },
    {
      id: 'session-2',
      title: 'Second Conversation',
      createdAt: '2023-01-02T00:00:00Z',
      lastMessageAt: '2023-01-02T02:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useHistory());

    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.selectedSession).toBeNull();
  });

  it('loads all sessions successfully', async () => {
    (historyService.getAllSessions as jest.MockedFunction<any>).mockResolvedValue(mockSessions);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(historyService.getAllSessions).toHaveBeenCalledTimes(1);
    expect(result.current.sessions).toEqual(mockSessions);
    expect(result.current.loading).toBe(false);
  });

  it('handles error when loading sessions', async () => {
    const errorMessage = 'Failed to load sessions';
    (historyService.getAllSessions as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await expect(result.current.loadSessions()).rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.loading).toBe(false);
  });

  it('maintains loading state during session loading', async () => {
    (historyService.getAllSessions as jest.MockedFunction<any>).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockSessions), 10))
    );

    const { result } = renderHook(() => useHistory());

    // Start loading
    const loadPromise = act(async () => {
      await result.current.loadSessions();
    });

    // Loading should be true immediately
    expect(result.current.loading).toBe(true);

    // Wait for loading to complete
    await loadPromise;

    // Loading should be false after completion
    expect(result.current.loading).toBe(false);
  });

  it('selects a session by ID', async () => {
    const mockSessionDetail = {
      ...mockSessions[0],
      messages: [
        { id: 'msg-1', content: 'Hello', sender: 'user', timestamp: '2023-01-01T00:30:00Z' },
        { id: 'msg-2', content: 'Hi there!', sender: 'assistant', timestamp: '2023-01-01T00:31:00Z' },
      ],
    };

    (historyService.getSessionById as jest.MockedFunction<any>).mockResolvedValue(mockSessionDetail);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.selectSession(mockSessions[0].id);
    });

    expect(historyService.getSessionById).toHaveBeenCalledWith(mockSessions[0].id);
    expect(result.current.selectedSession).toEqual(mockSessionDetail);
  });

  it('handles error when selecting session', async () => {
    const errorMessage = 'Session not found';
    (historyService.getSessionById as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await expect(result.current.selectSession('non-existent-id')).rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);
  });

  it('deletes a session successfully', async () => {
    (historyService.deleteSession as jest.MockedFunction<any>).mockResolvedValue(undefined);
    (historyService.getAllSessions as jest.MockedFunction<any>).mockResolvedValue(mockSessions);

    const { result } = renderHook(() => useHistory());

    // First load sessions
    await act(async () => {
      await result.current.loadSessions();
    });

    // Then delete a session
    await act(async () => {
      await result.current.deleteSession(mockSessions[0].id);
    });

    expect(historyService.deleteSession).toHaveBeenCalledWith(mockSessions[0].id);
    expect(historyService.getAllSessions).toHaveBeenCalledTimes(2); // Initial load + after deletion
  });

  it('handles error when deleting session', async () => {
    const errorMessage = 'Failed to delete session';
    (historyService.deleteSession as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await expect(result.current.deleteSession('session-id')).rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);
  });

  it('clears selected session when needed', async () => {
    const mockSessionDetail = {
      ...mockSessions[0],
      messages: [
        { id: 'msg-1', content: 'Hello', sender: 'user', timestamp: '2023-01-01T00:30:00Z' },
      ],
    };

    (historyService.getSessionById as jest.MockedFunction<any>).mockResolvedValue(mockSessionDetail);

    const { result } = renderHook(() => useHistory());

    // Select a session
    await act(async () => {
      await result.current.selectSession(mockSessions[0].id);
    });

    expect(result.current.selectedSession).not.toBeNull();

    // Clear selection
    await act(async () => {
      result.current.clearSelectedSession();
    });

    expect(result.current.selectedSession).toBeNull();
  });

  it('filters sessions based on search query', async () => {
    const sessionsWithDifferentTitles = [
      { ...mockSessions[0], title: 'Project Discussion' },
      { ...mockSessions[1], title: 'Personal Chat' },
      { id: 'session-3', title: 'Work Meeting', createdAt: '2023-01-03T00:00:00Z', lastMessageAt: '2023-01-03T03:00:00Z' },
    ];

    (historyService.getAllSessions as jest.MockedFunction<any>).mockResolvedValue(sessionsWithDifferentTitles);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadSessions();
    });

    // Apply search filter
    act(() => {
      result.current.setSearchQuery('Project');
    });

    expect(result.current.filteredSessions).toEqual([sessionsWithDifferentTitles[0]]);
  });

  it('sorts sessions by date', async () => {
    const unsortedSessions = [
      { ...mockSessions[1], createdAt: '2023-01-02T00:00:00Z', lastMessageAt: '2023-01-02T02:00:00Z' }, // newer
      { ...mockSessions[0], createdAt: '2023-01-01T00:00:00Z', lastMessageAt: '2023-01-01T01:00:00Z' }, // older
    ];

    (historyService.getAllSessions as jest.MockedFunction<any>).mockResolvedValue(unsortedSessions);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadSessions();
    });

    // By default, should be sorted by lastMessageAt (descending - most recent first)
    expect(result.current.sessions[0].id).toBe(unsortedSessions[0].id); // Most recent first
    expect(result.current.sessions[1].id).toBe(unsortedSessions[1].id); // Older second
  });

  it('clears error when performing new action', async () => {
    const errorMessage = 'Initial error';
    (historyService.getAllSessions as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useHistory());

    // Cause an error
    await act(async () => {
      await expect(result.current.loadSessions()).rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);

    // Clear error by mocking success
    (historyService.getAllSessions as jest.MockedFunction<any>).mockResolvedValue(mockSessions);

    // Perform another action
    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.error).toBeNull();
  });

  it('handles empty sessions list', async () => {
    (historyService.getAllSessions as jest.MockedFunction<any>).mockResolvedValue([]);

    const { result } = renderHook(() => useHistory());

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.sessions).toEqual([]);
    expect(result.current.filteredSessions).toEqual([]);
  });

  it('maintains search query state', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.setSearchQuery('test search');
    });

    expect(result.current.searchQuery).toBe('test search');
  });

  it('resets to initial state', async () => {
    (historyService.getAllSessions as jest.MockedFunction<any>).mockResolvedValue(mockSessions);

    const { result } = renderHook(() => useHistory());

    // Load some data
    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.sessions).toHaveLength(2);

    // Reset state
    act(() => {
      result.current.reset();
    });

    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.selectedSession).toBeNull();
    expect(result.current.searchQuery).toBe('');
  });

  it('loads session details while maintaining loading state', async () => {
    const mockSessionDetail = {
      ...mockSessions[0],
      messages: [
        { id: 'msg-1', content: 'Hello', sender: 'user', timestamp: '2023-01-01T00:30:00Z' },
      ],
    };

    // Make the API call take some time to verify loading state
    (historyService.getSessionById as jest.MockedFunction<any>).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockSessionDetail), 10))
    );

    const { result } = renderHook(() => useHistory());

    // Start selecting session
    const selectPromise = act(async () => {
      await result.current.selectSession(mockSessions[0].id);
    });

    // Loading should be true during selection
    expect(result.current.loading).toBe(true);

    // Wait for selection to complete
    await selectPromise;

    // Loading should be false after completion
    expect(result.current.loading).toBe(false);
    expect(result.current.selectedSession).toEqual(mockSessionDetail);
  });
});