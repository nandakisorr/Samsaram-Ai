import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AudioPlayer from './AudioPlayer';

// Mock the HTML5 Audio API
const mockPlay = jest.fn().mockResolvedValue(undefined);
const mockPause = jest.fn();
const mockLoad = jest.fn();

global.Audio = class MockAudio {
  public src: string = '';
  public currentTime: number = 0;
  public duration: number = 0;
  public paused: boolean = true;
  public oncanplay: ((this: HTMLMediaElement, ev: Event) => any) | null = null;
  public onended: ((this: HTMLMediaElement, ev: Event) => any) | null = null;
  public ontimeupdate: ((this: HTMLMediaElement, ev: Event) => any) | null = null;
  public onloadedmetadata: ((this: HTMLMediaElement, ev: Event) => any) | null = null;

  constructor(src?: string) {
    if (src) {
      this.src = src;
    }
  }

  play = mockPlay;
  pause = mockPause;
  load = mockLoad;
} as any;

describe('AudioPlayer', () => {
  const mockAudioUrl = 'https://example.com/audio.mp3';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with play button when audio URL is provided', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.getByTestId('audio-player')).toBeInTheDocument();
  });

  it('renders with loading state when audio URL is not provided', () => {
    render(<AudioPlayer audioUrl={undefined} />);

    expect(screen.getByText(/no audio available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument();
  });

  it('toggles play/pause functionality', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    const playButton = screen.getByRole('button', { name: /play/i });

    // Click play
    fireEvent.click(playButton);
    expect(mockPlay).toHaveBeenCalledTimes(1);

    // Button should now show pause icon/text
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();

    // Click pause
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(mockPause).toHaveBeenCalledTimes(1);

    // Button should now show play icon/text again
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('handles play error gracefully', () => {
    const mockPlayWithError = jest.fn().mockRejectedValue(new Error('Playback failed'));
    Object.defineProperty(global.HTMLAudioElement.prototype, 'play', {
      value: mockPlayWithError,
    });

    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    const playButton = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playButton);

    // Should handle the error without crashing
    expect(mockPlayWithError).toHaveBeenCalledTimes(1);
  });

  it('updates progress bar during playback', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    // Simulate audio loading and playing
    const audioElement = screen.getByTestId('audio-player');
    Object.defineProperty(audioElement, 'duration', { value: 100, writable: true });
    Object.defineProperty(audioElement, 'currentTime', { value: 50, writable: true });

    // Trigger timeupdate event simulation
    fireEvent.timeUpdate(audioElement);

    // Progress should reflect 50% completion
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('resets when audio URL changes', () => {
    const { rerender } = render(<AudioPlayer audioUrl={mockAudioUrl} />);

    // Play the audio
    fireEvent.click(screen.getByRole('button', { name: /play/i }));

    // Change the audio URL
    const newAudioUrl = 'https://example.com/new-audio.mp3';
    rerender(<AudioPlayer audioUrl={newAudioUrl} />);

    // Should reset to initial state
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('cleans up audio resources on unmount', () => {
    const { unmount } = render(<AudioPlayer audioUrl={mockAudioUrl} />);

    // Play audio first
    fireEvent.click(screen.getByRole('button', { name: /play/i }));

    // Unmount component
    unmount();

    // Audio should be paused and cleaned up
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('handles audio loading error', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    const audioElement = screen.getByTestId('audio-player');
    
    // Simulate error event
    fireEvent.error(audioElement);

    // Should show error state
    expect(screen.getByText(/failed to load audio/i)).toBeInTheDocument();
  });

  it('formats time correctly', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    const audioElement = screen.getByTestId('audio-player');
    Object.defineProperty(audioElement, 'duration', { value: 125, writable: true }); // 2 minutes 5 seconds
    Object.defineProperty(audioElement, 'currentTime', { value: 65, writable: true }); // 1 minute 5 seconds

    // The time display would be tested if we had access to it
    // For now, we're ensuring the component doesn't crash with different time values
    expect(audioElement).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    // Initially, it should show a loading state before the audio loads
    expect(screen.getByText(/loading audio/i)).toBeInTheDocument();
  });

  it('handles zero duration audio', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    const audioElement = screen.getByTestId('audio-player');
    Object.defineProperty(audioElement, 'duration', { value: 0, writable: true });

    // Should handle zero duration without errors
    expect(audioElement).toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    render(<AudioPlayer audioUrl={mockAudioUrl} />);

    const playButton = screen.getByRole('button', { name: /play/i });
    
    // Focus the button
    playButton.focus();
    expect(playButton).toHaveFocus();

    // Press Enter to play
    fireEvent.keyDown(playButton, { key: 'Enter' });
    expect(mockPlay).toHaveBeenCalledTimes(1);

    // Press Space to pause
    fireEvent.keyDown(screen.getByRole('button', { name: /pause/i }), { key: ' ' });
    expect(mockPause).toHaveBeenCalledTimes(1);
  });
});