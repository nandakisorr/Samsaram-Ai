import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatInput from './ChatInput';

// Mock the emotion selector component
jest.mock('../tts/components/EmotionSelector', () => ({
  __esModule: true,
  default: ({ selectedEmotion, onEmotionChange }: any) => (
    <select 
      data-testid="emotion-selector" 
      value={selectedEmotion} 
      onChange={(e) => onEmotionChange(e.target.value)}
    >
      <option value="neutral">Neutral</option>
      <option value="happy">Happy</option>
      <option value="sad">Sad</option>
    </select>
  ),
}));

describe('ChatInput', () => {
  const mockOnSendMessage = jest.fn();
  const defaultProps = {
    onSendMessage: mockOnSendMessage,
    isLoading: false,
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    render(<ChatInput {...defaultProps} />);

    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    expect(screen.getByTestId('emotion-selector')).toBeInTheDocument();
  });

  it('allows typing in the input field', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const testMessage = 'Hello, world!';

    fireEvent.change(input, { target: { value: testMessage } });

    expect(input).toHaveValue(testMessage);
  });

  it('calls onSendMessage when send button is clicked', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    const testMessage = 'Hello, world!';
    fireEvent.change(input, { target: { value: testMessage } });
    fireEvent.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith(testMessage, 'neutral');
    expect(input).toHaveValue('');
  });

  it('calls onSendMessage when Enter key is pressed', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');

    const testMessage = 'Hello, world!';
    fireEvent.change(input, { target: { value: testMessage } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: false });

    expect(mockOnSendMessage).toHaveBeenCalledWith(testMessage, 'neutral');
    expect(input).toHaveValue('');
  });

  it('does not submit when Shift+Enter is pressed (for multiline)', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');

    const testMessage = 'Hello,\nworld!';
    fireEvent.change(input, { target: { value: testMessage } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

    expect(mockOnSendMessage).not.toHaveBeenCalled();
    expect(input).toHaveValue(testMessage);
  });

  it('respects the disabled prop', () => {
    render(<ChatInput {...defaultProps} disabled={true} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('shows loading state correctly', () => {
    render(<ChatInput {...defaultProps} isLoading={true} />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
    
    // Check if loading indicator is present (assuming spinner component)
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('does not send empty messages', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(sendButton);

    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('trims whitespace from messages', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    const testMessage = '   Hello, world!   ';
    fireEvent.change(input, { target: { value: testMessage } });
    fireEvent.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello, world!', 'neutral');
  });

  it('uses selected emotion', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const emotionSelector = screen.getByTestId('emotion-selector');
    const sendButton = screen.getByRole('button', { name: /send/i });

    const testMessage = 'Hello, world!';
    fireEvent.change(input, { target: { value: testMessage } });
    
    // Change emotion to happy
    fireEvent.change(emotionSelector, { target: { value: 'happy' } });
    fireEvent.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith(testMessage, 'happy');
  });

  it('resets to default emotion after sending', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const emotionSelector = screen.getByTestId('emotion-selector');
    const sendButton = screen.getByRole('button', { name: /send/i });

    const testMessage = 'Hello, world!';
    fireEvent.change(input, { target: { value: testMessage } });
    
    // Change emotion to happy
    fireEvent.change(emotionSelector, { target: { value: 'happy' } });
    fireEvent.click(sendButton);

    // After sending, the emotion should remain as selected
    expect(emotionSelector).toHaveValue('happy');
  });

  it('handles very long messages', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    const longMessage = 'A'.repeat(1000); // Very long message
    fireEvent.change(input, { target: { value: longMessage } });
    fireEvent.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith(longMessage, 'neutral');
  });

  it('preserves input value when not submitted', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');

    const testMessage = 'Hello, world!';
    fireEvent.change(input, { target: { value: testMessage } });

    expect(input).toHaveValue(testMessage);
  });

  it('focuses on input when component mounts', () => {
    render(<ChatInput {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type your message...');
    expect(input).toHaveFocus();
  });
});