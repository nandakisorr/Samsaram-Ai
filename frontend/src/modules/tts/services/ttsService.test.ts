import { generateSpeech, getAvailableVoices, getAvailableEmotions } from './ttsService';
import apiClient from '@/core/api/client';

// Mock the apiClient
jest.mock('@/core/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('ttsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSpeech', () => {
    it('should generate speech successfully', async () => {
      const mockRequest = { 
        text: 'Hello, how are you?', 
        voice: 'en-US-JennyNeural', 
        emotion: 'neutral',
        speed: 1.0 
      };
      const mockResponse = { 
        audioUrl: 'https://example.com/audio.mp3',
        duration: 2.5,
        voice: 'en-US-JennyNeural'
      };
      (mockApiClient.post as jest.MockedFunction<any>).mockResolvedValue({ data: mockResponse });

      const result = await generateSpeech(mockRequest);

      expect(mockApiClient.post).toHaveBeenCalledWith('/tts/generate', mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when generating speech', async () => {
      const mockRequest = { 
        text: 'Hello, how are you?', 
        voice: 'en-US-JennyNeural', 
        emotion: 'neutral',
        speed: 1.0 
      };
      const errorMessage = 'Failed to generate speech';
      (mockApiClient.post as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(generateSpeech(mockRequest)).rejects.toThrow(errorMessage);
    });

    it('should handle empty text input', async () => {
      const mockRequest = { 
        text: '', 
        voice: 'en-US-JennyNeural', 
        emotion: 'neutral',
        speed: 1.0 
      };
      const errorMessage = 'Text cannot be empty';
      (mockApiClient.post as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(generateSpeech(mockRequest)).rejects.toThrow(errorMessage);
    });
  });

  describe('getAvailableVoices', () => {
    it('should return available voices', async () => {
      const mockVoices = [
        { id: 'en-US-JennyNeural', name: 'Jenny', locale: 'en-US', gender: 'Female' },
        { id: 'en-US-GuyNeural', name: 'Guy', locale: 'en-US', gender: 'Male' },
        { id: 'es-ES-ElviraNeural', name: 'Elvira', locale: 'es-ES', gender: 'Female' }
      ];
      (mockApiClient.get as jest.MockedFunction<any>).mockResolvedValue({ data: mockVoices });

      const result = await getAvailableVoices();

      expect(mockApiClient.get).toHaveBeenCalledWith('/tts/voices');
      expect(result).toEqual(mockVoices);
    });

    it('should handle errors when fetching voices', async () => {
      const errorMessage = 'Failed to fetch voices';
      (mockApiClient.get as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(getAvailableVoices()).rejects.toThrow(errorMessage);
    });
  });

  describe('getAvailableEmotions', () => {
    it('should return available emotions', async () => {
      const mockEmotions = [
        { id: 'neutral', name: 'Neutral', description: 'Normal speaking tone' },
        { id: 'happy', name: 'Happy', description: 'Positive and cheerful tone' },
        { id: 'sad', name: 'Sad', description: 'Somber and melancholic tone' },
        { id: 'angry', name: 'Angry', description: 'Frustrated and intense tone' },
        { id: 'excited', name: 'Excited', description: 'Enthusiastic and energetic tone' }
      ];
      (mockApiClient.get as jest.MockedFunction<any>).mockResolvedValue({ data: mockEmotions });

      const result = await getAvailableEmotions();

      expect(mockApiClient.get).toHaveBeenCalledWith('/tts/emotions');
      expect(result).toEqual(mockEmotions);
    });

    it('should handle errors when fetching emotions', async () => {
      const errorMessage = 'Failed to fetch emotions';
      (mockApiClient.get as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(getAvailableEmotions()).rejects.toThrow(errorMessage);
    });
  });
});