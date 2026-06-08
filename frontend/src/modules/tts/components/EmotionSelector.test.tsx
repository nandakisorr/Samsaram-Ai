import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmotionSelector from './EmotionSelector';

// Mock the TTS service
jest.mock('../../services/ttsService', () => ({
  getAvailableEmotions: jest.fn().mockResolvedValue([
    { id: 'neutral', name: 'Neutral', description: 'Normal speaking tone' },
    { id: 'happy', name: 'Happy', description: 'Positive and cheerful tone' },
    { id: 'sad', name: 'Sad', description: 'Somber and melancholic tone' },
    { id: 'angry', name: 'Angry', description: 'Frustrated and intense tone' },
    { id: 'excited', name: 'Excited', description: 'Enthusiastic and energetic tone' },
  ]),
}));

describe('EmotionSelector', () => {
  const mockOnEmotionChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default emotion selected', () => {
    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    expect(screen.getByText('Select Emotion')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Neutral' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Happy' })).toBeInTheDocument();
  });

  it('displays all available emotions', async () => {
    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    // Open the dropdown
    const selectElement = screen.getByRole('combobox');
    fireEvent.mouseDown(selectElement);

    // Wait for emotions to load and be displayed
    expect(await screen.findByRole('option', { name: 'Neutral' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Happy' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sad' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Angry' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Excited' })).toBeInTheDocument();
  });

  it('calls onEmotionChange when emotion is selected', async () => {
    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    const selectElement = screen.getByRole('combobox');
    
    // Click to open dropdown
    fireEvent.mouseDown(selectElement);
    
    // Select a different emotion
    const happyOption = await screen.findByRole('option', { name: 'Happy' });
    fireEvent.click(happyOption);

    expect(mockOnEmotionChange).toHaveBeenCalledWith('happy');
  });

  it('shows currently selected emotion', () => {
    render(<EmotionSelector selectedEmotion="happy" onEmotionChange={mockOnEmotionChange} />);

    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toHaveValue('happy');
  });

  it('handles loading state', () => {
    // Mock a delayed response to test loading state
    jest.mock('../../services/ttsService', () => ({
      getAvailableEmotions: jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([
          { id: 'neutral', name: 'Neutral', description: 'Normal speaking tone' },
        ]), 100))
      ),
    }));

    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    // Initially should show loading state
    expect(screen.getByText(/loading emotions/i)).toBeInTheDocument();
  });

  it('handles error state', async () => {
    // Mock an error in the service
    jest.mock('../../services/ttsService', () => ({
      getAvailableEmotions: jest.fn().mockRejectedValue(new Error('Failed to load emotions')),
    }));

    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    // Wait for error to be handled
    expect(await screen.findByText(/failed to load emotions/i)).toBeInTheDocument();
  });

  it('filters emotions when searching', async () => {
    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    const selectElement = screen.getByRole('combobox');
    fireEvent.mouseDown(selectElement);

    // Wait for options to load
    await screen.findByRole('option', { name: 'Neutral' });

    // Type in search (if the component supports search)
    fireEvent.change(selectElement, { target: { value: 'hap' } });

    // Should filter to show only matching emotions
    expect(screen.getByRole('option', { name: 'Happy' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sad' })).not.toBeInTheDocument();
  });

  it('shows emotion descriptions as tooltips', async () => {
    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    const selectElement = screen.getByRole('combobox');
    fireEvent.mouseDown(selectElement);

    const happyOption = await screen.findByRole('option', { name: 'Happy' });
    
    // Hover over option to see description
    fireEvent.mouseOver(happyOption);
    
    // Description should be visible
    expect(screen.getByText('Positive and cheerful tone')).toBeInTheDocument();
  });

  it('maintains selection when component re-renders', async () => {
    const { rerender } = render(<EmotionSelector selectedEmotion="sad" onEmotionChange={mockOnEmotionChange} />);

    // Wait for initial load
    await screen.findByRole('option', { name: 'Neutral' });

    // Re-render with same props
    rerender(<EmotionSelector selectedEmotion="sad" onEmotionChange={mockOnEmotionChange} />);

    // Selection should remain the same
    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toHaveValue('sad');
  });

  it('handles empty emotion list', async () => {
    // Mock empty emotion list
    jest.mock('../../services/ttsService', () => ({
      getAvailableEmotions: jest.fn().mockResolvedValue([]),
    }));

    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    // Should handle empty list gracefully
    expect(await screen.findByText(/no emotions available/i)).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    render(<EmotionSelector selectedEmotion="neutral" onEmotionChange={mockOnEmotionChange} />);

    const selectElement = screen.getByRole('combobox');
    
    // Focus the select element
    selectElement.focus();
    expect(selectElement).toHaveFocus();

    // Open dropdown with arrow down
    fireEvent.keyDown(selectElement, { key: 'ArrowDown' });
    
    // Wait for options to load
    await screen.findByRole('option', { name: 'Neutral' });

    // Navigate with arrow keys
    fireEvent.keyDown(selectElement, { key: 'ArrowDown' }); // Move to Happy
    fireEvent.keyDown(selectElement, { key: 'Enter' }); // Select

    expect(mockOnEmotionChange).toHaveBeenCalledWith('happy');
  });

  it('respects disabled prop', () => {
    render(<EmotionSelector 
      selectedEmotion="neutral" 
      onEmotionChange={mockOnEmotionChange} 
      disabled={true} 
    />);

    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toBeDisabled();
  });
});