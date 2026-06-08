import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatMessage from './ChatMessage';
import { ChatMessage as ChatMessageType } from '../types';

// Mock the audio player component
jest.mock('../../tts/components/AudioPlayer', () => ({
  __esModule: true,
  default: ({ audioUrl, onPlay, onPause }: any) => (
    <div data-testid="audio-player" onClick={onPlay}>
      Audio Player - {audioUrl ? 'Has Audio' : 'No Audio'}
    </div>
  ),
}));

describe('ChatMessage', () => {
  const mockMessage: ChatMessageType = {
    id: 'msg-1',
    content: 'Hello, how are you?',
    sender: 'user',
    timestamp: new Date('2023-01-01T10:00:00Z').toISOString(),
    audioUrl: 'https://example.com/audio.mp3',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user message correctly', () => {
    render(<ChatMessage message={mockMessage} />);

    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByTestId('chat-message-user-msg-1')).toHaveClass('bg-blue-500');
    expect(screen.getByText('10:00 AM')).toBeInTheDocument(); // Assuming time is formatted
  });

  it('renders assistant message correctly', () => {
    const assistantMessage = {
      ...mockMessage,
      sender: 'assistant',
      id: 'msg-2',
    };

    render(<ChatMessage message={assistantMessage} />);

    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByTestId('chat-message-assistant-msg-2')).toHaveClass('bg-gray-200');
    expect(screen.getByTestId('audio-player')).toBeInTheDocument();
  });

  it('does not render audio player for user messages', () => {
    render(<ChatMessage message={mockMessage} />);

    expect(screen.queryByTestId('audio-player')).not.toBeInTheDocument();
  });

  it('renders loading state when content is empty', () => {
    const loadingMessage = {
      ...mockMessage,
      content: '',
    };

    render(<ChatMessage message={loadingMessage} />);

    expect(screen.getByTestId('message-content-loading')).toBeInTheDocument();
  });

  it('formats timestamp correctly', () => {
    render(<ChatMessage message={mockMessage} />);

    // The exact format depends on the implementation, but it should show some time representation
    const timeElement = screen.getByText(/AM|PM|\d{1,2}:\d{2}/);
    expect(timeElement).toBeInTheDocument();
  });

  it('applies correct CSS classes based on sender', () => {
    // Test user message
    const { rerender } = render(<ChatMessage message={mockMessage} />);
    expect(screen.getByTestId('chat-message-user-msg-1')).toHaveClass('bg-blue-500');

    // Test assistant message
    const assistantMessage = {
      ...mockMessage,
      sender: 'assistant',
    };
    rerender(<ChatMessage message={assistantMessage} />);
    expect(screen.getByTestId('chat-message-assistant-msg-1')).toHaveClass('bg-gray-200');
  });

  it('handles long messages properly', () => {
    const longMessage = {
      ...mockMessage,
      content: 'This is a very long message that should wrap properly and not break the layout. '.repeat(10),
    };

    render(<ChatMessage message={longMessage} />);

    const messageElement = screen.getByText(longMessage.content);
    expect(messageElement).toBeInTheDocument();
    // Should not overflow or break layout
    expect(messageElement).toHaveClass('whitespace-pre-wrap');
  });

  it('displays message with special characters properly', () => {
    const specialCharMessage = {
      ...mockMessage,
      content: 'Hello! How are you? I\'m fine. Thanks for asking. 😊',
    };

    render(<ChatMessage message={specialCharMessage} />);

    expect(screen.getByText(specialCharMessage.content)).toBeInTheDocument();
  });

  it('renders without audioUrl for assistant message', () => {
    const messageWithoutAudio = {
      ...mockMessage,
      sender: 'assistant',
      audioUrl: undefined,
    };

    render(<ChatMessage message={messageWithoutAudio} />);

    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByTestId('audio-player')).toBeInTheDocument();
    // The audio player should render but indicate no audio is available
    expect(screen.getByText('Audio Player - No Audio')).toBeInTheDocument();
  });
});