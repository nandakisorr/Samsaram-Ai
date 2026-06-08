import { renderHook, act } from '@testing-library/react';
import { useTTS } from '../../hooks/useTTS';
import * as ttsService from '../services/ttsService';

// Mock the TTS service
jest.mock('../services/ttsService', () => ({
  generateSpeech: jest.fn(),
  getAvailableVoices: jest.fn(),
  getAvailableEmotions: jest.fn(),
}));

describe('useTTS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useTTS());

    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.availableVoices).toEqual([]);
    expect(result.current.availableEmotions).toEqual([]);
  });

  it('loads available voices and emotions on initialization', async () => {
    const mockVoices = [
      { id: 'en-US-JennyNeural', name: 'Jenny', locale: 'en-US', gender: 'Female' },
      { id: 'en-US-GuyNeural', name: 'Guy', locale: 'en-US', gender: 'Male' },
    ];
    const mockEmotions = [
      { id: 'neutral', name: 'Neutral', description: 'Normal speaking tone' },
      { id: 'happy', name: 'Happy', description: 'Positive and cheerful tone' },
    ];

    (ttsService.getAvailableVoices as jest.MockedFunction<any>).mockResolvedValue(mockVoices);
    (ttsService.getAvailableEmotions as jest.MockedFunction<any>).mockResolvedValue(mockEmotions);

    const { result } = renderHook(() => useTTS());

    // Wait for the effects to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(ttsService.getAvailableVoices).toHaveBeenCalledTimes(1);
    expect(ttsService.getAvailableEmotions).toHaveBeenCalledTimes(1);
    expect(result.current.availableVoices).toEqual(mockVoices);
    expect(result.current.availableEmotions).toEqual(mockEmotions);
  });

  it('handles errors when loading voices and emotions', async () => {
    const errorMessage = 'Failed to load TTS data';
    (ttsService.getAvailableVoices as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));
    (ttsService.getAvailableEmotions as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useTTS());

    // Wait for the effects to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBe(errorMessage);
  });

  it('generates speech successfully', async () => {
    const mockText = 'Hello, how are you?';
    const mockVoice = 'en-US-JennyNeural';
    const mockEmotion = 'happy';
    const mockSpeed = 1.0;
    
    const mockResponse = {
      audioUrl: 'https://example.com/audio.mp3',
      duration: 2.5,
      voice: 'en-US-JennyNeural'
    };

    (ttsService.generateSpeech as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useTTS());

    await act(async () => {
      const audioUrl = await result.current.generateSpeech(mockText, mockVoice, mockEmotion, mockSpeed);
      expect(audioUrl).toBe(mockResponse.audioUrl);
    });

    expect(ttsService.generateSpeech).toHaveBeenCalledWith({
      text: mockText,
      voice: mockVoice,
      emotion: mockEmotion,
      speed: mockSpeed
    });
    expect(result.current.isGenerating).toBe(false);
  });

  it('handles speech generation error', async () => {
    const mockText = 'Hello, how are you?';
    const mockVoice = 'en-US-JennyNeural';
    const mockEmotion = 'happy';
    const mockSpeed = 1.0;
    
    const errorMessage = 'Failed to generate speech';
    (ttsService.generateSpeech as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useTTS());

    await act(async () => {
      await expect(result.current.generateSpeech(mockText, mockVoice, mockEmotion, mockSpeed))
        .rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isGenerating).toBe(false);
  });

  it('maintains loading state during speech generation', async () => {
    const mockText = 'Hello, how are you?';
    const mockVoice = 'en-US-JennyNeural';
    const mockEmotion = 'happy';
    const mockSpeed = 1.0;
    
    const mockResponse = { audioUrl: 'https://example.com/audio.mp3', duration: 2.5, voice: 'en-US-JennyNeural' };

    // Make the API call take some time to verify loading state
    (ttsService.generateSpeech as jest.MockedFunction<any>).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockResponse), 10))
    );

    const { result } = renderHook(() => useTTS());

    // Start speech generation
    const generatePromise = act(async () => {
      await result.current.generateSpeech(mockText, mockVoice, mockEmotion, mockSpeed);
    });

    // Loading should be true immediately
    expect(result.current.isGenerating).toBe(true);

    // Wait for generation to complete
    await generatePromise;

    // Loading should be false after completion
    expect(result.current.isGenerating).toBe(false);
  });

  it('clears error when performing new action', async () => {
    const mockText = 'Hello, how are you?';
    const mockVoice = 'en-US-JennyNeural';
    const mockEmotion = 'happy';
    const mockSpeed = 1.0;
    
    const errorMessage = 'Failed to generate speech';
    (ttsService.generateSpeech as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useTTS());

    // Cause an error
    await act(async () => {
      await expect(result.current.generateSpeech(mockText, mockVoice, mockEmotion, mockSpeed))
        .rejects.toThrow(errorMessage);
    });

    expect(result.current.error).toBe(errorMessage);

    // Clear error by mocking success
    (ttsService.generateSpeech as jest.MockedFunction<any>).mockResolvedValue({
      audioUrl: 'https://example.com/audio.mp3',
      duration: 2.5,
      voice: 'en-US-JennyNeural'
    });

    // Perform another action
    await act(async () => {
      await result.current.generateSpeech(mockText, mockVoice, mockEmotion, mockSpeed);
    });

    expect(result.current.error).toBeNull();
  });

  it('validates input parameters for speech generation', async () => {
    const { result } = renderHook(() => useTTS());

    // Test with empty text
    await act(async () => {
      await expect(result.current.generateSpeech('', 'voice', 'emotion', 1.0))
        .rejects.toThrow('Text cannot be empty');
    });

    // Test with invalid voice
    await act(async () => {
      await expect(result.current.generateSpeech('Hello', '', 'emotion', 1.0))
        .rejects.toThrow('Voice cannot be empty');
    });

    // Test with invalid emotion
    await act(async () => {
      await expect(result.current.generateSpeech('Hello', 'voice', '', 1.0))
        .rejects.toThrow('Emotion cannot be empty');
    });
  });

  it('provides default values for optional parameters', async () => {
    const mockText = 'Hello, how are you?';
    const mockVoice = 'en-US-JennyNeural';
    const mockEmotion = 'neutral'; // Default emotion
    
    const mockResponse = {
      audioUrl: 'https://example.com/audio.mp3',
      duration: 2.5,
      voice: 'en-US-JennyNeural'
    };

    (ttsService.generateSpeech as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useTTS());

    // Call with minimal parameters (speed defaults to 1.0)
    await act(async () => {
      await result.current.generateSpeech(mockText, mockVoice, mockEmotion);
    });

    expect(ttsService.generateSpeech).toHaveBeenCalledWith({
      text: mockText,
      voice: mockVoice,
      emotion: mockEmotion,
      speed: 1.0 // Default value
    });
  });

  it('handles concurrent speech generations gracefully', async () => {
    const mockResponse1 = { audioUrl: 'https://example.com/audio1.mp3', duration: 2.5, voice: 'voice1' };
    const mockResponse2 = { audioUrl: 'https://example.com/audio2.mp3', duration: 3.0, voice: 'voice2' };

    (ttsService.generateSpeech as jest.MockedFunction<any>)
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2);

    const { result } = renderHook(() => useTTS());

    // Start two concurrent generations
    await act(async () => {
      const promise1 = result.current.generateSpeech('text1', 'voice1', 'neutral', 1.0);
      const promise2 = result.current.generateSpeech('text2', 'voice2', 'neutral', 1.0);
      
      await Promise.all([promise1, promise2]);
    });

    expect(ttsService.generateSpeech).toHaveBeenCalledTimes(2);
    expect(result.current.isGenerating).toBe(false); // Should be false after both complete
  });

  it('resets error state when loading data successfully', async () => {
    const mockError = 'Initial load error';
    const mockVoices = [{ id: 'voice1', name: 'Voice 1', locale: 'en-US', gender: 'Female' }];
    const mockEmotions = [{ id: 'happy', name: 'Happy', description: 'Happy emotion' }];

    // First call fails, subsequent calls succeed
    (ttsService.getAvailableVoices as jest.MockedFunction<any>)
      .mockRejectedValueOnce(new Error(mockError))
      .mockResolvedValueOnce(mockVoices);
    (ttsService.getAvailableEmotions as jest.MockedFunction<any>)
      .mockRejectedValueOnce(new Error(mockError))
      .mockResolvedValueOnce(mockEmotions);

    const { result } = renderHook(() => useTTS());

    // Wait for initial load attempt
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Error should be present
    expect(result.current.error).toBe(mockError);

    // Manually trigger reload (in a real scenario, this might happen automatically)
    await act(async () => {
      await Promise.all([
        result.current.loadAvailableVoices(),
        result.current.loadAvailableEmotions()
      ]);
    });

    // Error should be cleared after successful reload
    expect(result.current.error).toBeNull();
  });

  it('provides methods to manually reload voices and emotions', async () => {
    const mockVoices = [{ id: 'voice1', name: 'Voice 1', locale: 'en-US', gender: 'Female' }];
    const mockEmotions = [{ id: 'happy', name: 'Happy', description: 'Happy emotion' }];

    (ttsService.getAvailableVoices as jest.MockedFunction<any>).mockResolvedValue(mockVoices);
    (ttsService.getAvailableEmotions as jest.MockedFunction<any>).mockResolvedValue(mockEmotions);

    const { result } = renderHook(() => useTTS());

    // Initially empty
    expect(result.current.availableVoices).toEqual([]);
    expect(result.current.availableEmotions).toEqual([]);

    // Manually load voices
    await act(async () => {
      await result.current.loadAvailableVoices();
    });

    expect(result.current.availableVoices).toEqual(mockVoices);

    // Manually load emotions
    await act(async () => {
      await result.current.loadAvailableEmotions();
    });

    expect(result.current.availableEmotions).toEqual(mockEmotions);
  });
});