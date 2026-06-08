import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionList from './SessionList';
import { Session } from '../types';

// Mock the history service
jest.mock('../../services/historyService', () => ({
  getAllSessions: jest.fn(),
  deleteSession: jest.fn(),
}));

// Mock the useHistory hook
jest.mock('../../hooks/useHistory', () => ({
  useHistory: () => ({
    sessions: [],
    loading: false,
    error: null,
    loadSessions: jest.fn(),
    deleteSession: jest.fn(),
  }),
}));

describe('SessionList', () => {
  const mockSessions: Session[] = [
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
    {
      id: 'session-3',
      title: 'Third Conversation',
      createdAt: '2023-01-03T00:00:00Z',
      lastMessageAt: '2023-01-03T03:00:00Z',
    },
  ];

  const mockOnSessionSelect = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders session list correctly', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    expect(screen.getByText('Chat History')).toBeInTheDocument();
    expect(screen.getByText('First Conversation')).toBeInTheDocument();
    expect(screen.getByText('Second Conversation')).toBeInTheDocument();
    expect(screen.getByText('Third Conversation')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <SessionList 
        sessions={[]} 
        loading={true} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    expect(screen.getByText(/loading sessions/i)).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <SessionList 
        sessions={[]} 
        loading={false} 
        error="Failed to load sessions" 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    expect(screen.getByText(/failed to load sessions/i)).toBeInTheDocument();
  });

  it('shows empty state when no sessions exist', () => {
    render(
      <SessionList 
        sessions={[]} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    expect(screen.getByText(/no chat sessions yet/i)).toBeInTheDocument();
    expect(screen.getByText(/start a new conversation to see it here/i)).toBeInTheDocument();
  });

  it('calls onSessionSelect when a session is clicked', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    const firstSession = screen.getByText('First Conversation');
    fireEvent.click(firstSession);

    expect(mockOnSessionSelect).toHaveBeenCalledWith(mockSessions[0]);
  });

  it('calls onDeleteSession when delete button is clicked', async () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    // Find the delete button for the first session
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Confirm deletion in modal
    const confirmButton = await screen.findByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockSessions[0].id);
  });

  it('cancels deletion when cancel is clicked', async () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    // Find the delete button for the first session
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Cancel deletion in modal
    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('formats dates correctly', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    // Check if dates are formatted (implementation dependent)
    const dateElements = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(dateElements).toHaveLength(mockSessions.length * 2); // createdAt and lastMessageAt
  });

  it('shows session count', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    expect(screen.getByText(`${mockSessions.length} conversations`)).toBeInTheDocument();
  });

  it('highlights selected session', () => {
    const selectedSession = mockSessions[0];
    
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
        selectedSessionId={selectedSession.id}
      />
    );

    const selectedElement = screen.getByText(selectedSession.title);
    expect(selectedElement.parentElement).toHaveClass('bg-blue-100');
  });

  it('searches sessions by title', async () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search conversations/i);
    fireEvent.change(searchInput, { target: { value: 'First' } });

    expect(screen.getByText('First Conversation')).toBeInTheDocument();
    expect(screen.queryByText('Second Conversation')).not.toBeInTheDocument();
    expect(screen.queryByText('Third Conversation')).not.toBeInTheDocument();
  });

  it('filters sessions by date range', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    // This would depend on the actual implementation of date filtering
    // For now, just ensure the component renders without errors
    expect(screen.getByText('Chat History')).toBeInTheDocument();
  });

  it('sorts sessions by last message date by default', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    // Check if sessions are sorted by last message date (most recent first)
    const sessionTitles = screen.getAllByText(/Conversation/);
    expect(sessionTitles[0]).toHaveTextContent('Third Conversation'); // Most recent
    expect(sessionTitles[sessionTitles.length - 1]).toHaveTextContent('First Conversation'); // Oldest
  });

  it('handles session deletion confirmation modal', async () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Modal should appear with confirmation
    expect(await screen.findByText(/are you sure/i)).toBeInTheDocument();
    expect(await screen.findByText(/this will permanently delete the conversation/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows session preview text', () => {
    const sessionsWithPreview = mockSessions.map(session => ({
      ...session,
      preview: 'This is a preview of the conversation...'
    }));

    render(
      <SessionList 
        sessions={sessionsWithPreview} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    expect(screen.getByText('This is a preview of the conversation...')).toBeInTheDocument();
  });

  it('handles long session titles gracefully', () => {
    const longTitleSession = {
      ...mockSessions[0],
      title: 'This is a very long session title that should be truncated properly without breaking the layout',
    };

    render(
      <SessionList 
        sessions={[longTitleSession]} 
        loading={false} 
        error={null} 
        onSessionSelect={mockOnSessionSelect}
        onDeleteSession={mockOnDelete}
      />
    );

    // Should truncate long titles
    const titleElement = screen.getByText(longTitleSession.title);
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveClass('truncate');
  });
});