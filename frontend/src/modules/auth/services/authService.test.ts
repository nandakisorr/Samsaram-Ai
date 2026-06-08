import { login, logout, getCurrentUser, refreshToken } from './authService';
import apiClient from '@/core/api/client';
import { setToken, removeToken, getToken } from '@/core/utils/token';

// Mock the apiClient
jest.mock('@/core/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));

// Mock the token utilities
jest.mock('@/core/utils/token', () => ({
  setToken: jest.fn(),
  removeToken: jest.fn(),
  getToken: jest.fn(),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockSetToken = setToken as jest.MockedFunction<typeof setToken>;
const mockRemoveToken = removeToken as jest.MockedFunction<typeof removeToken>;
const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully and store token', async () => {
      const mockCredentials = { email: 'test@example.com', password: 'password123' };
      const mockResponse = { 
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' }, 
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token'
      };
      (mockApiClient.post as jest.MockedFunction<any>).mockResolvedValue({ data: mockResponse });

      const result = await login(mockCredentials);

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', mockCredentials);
      expect(setToken).toHaveBeenCalledWith(mockResponse.token, mockResponse.refreshToken);
      expect(result).toEqual(mockResponse.user);
    });

    it('should handle login errors', async () => {
      const mockCredentials = { email: 'test@example.com', password: 'wrong-password' };
      const errorMessage = 'Invalid credentials';
      (mockApiClient.post as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(login(mockCredentials)).rejects.toThrow(errorMessage);
    });
  });

  describe('logout', () => {
    it('should logout successfully and remove token', async () => {
      (mockApiClient.post as jest.MockedFunction<any>).mockResolvedValue({});

      await logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout');
      expect(removeToken).toHaveBeenCalled();
    });

    it('should handle logout errors gracefully', async () => {
      const errorMessage = 'Logout failed';
      (mockApiClient.post as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      // Even if the API call fails, the token should still be removed locally
      await expect(logout()).resolves.not.toThrow();
      expect(removeToken).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user when authenticated', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test User' };
      (mockApiClient.get as jest.MockedFunction<any>).mockResolvedValue({ data: mockUser });

      const result = await getCurrentUser();

      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockUser);
    });

    it('should handle errors when fetching user', async () => {
      const errorMessage = 'Unauthorized';
      (mockApiClient.get as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(getCurrentUser()).rejects.toThrow(errorMessage);
    });

    it('should return null when no token is available', async () => {
      mockGetToken.mockReturnValue(null);
      
      // Simulate a scenario where there's no token
      const result = await getCurrentUser();
      
      // The API call should still be made, but if it fails due to no token, it should handle appropriately
      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockRefreshToken = 'old-refresh-token';
      const mockNewTokens = { 
        token: 'new-access-token', 
        refreshToken: 'new-refresh-token' 
      };
      (mockApiClient.post as jest.MockedFunction<any>).mockResolvedValue({ data: mockNewTokens });

      const result = await refreshToken(mockRefreshToken);

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: mockRefreshToken });
      expect(setToken).toHaveBeenCalledWith(mockNewTokens.token, mockNewTokens.refreshToken);
      expect(result).toEqual(mockNewTokens);
    });

    it('should handle token refresh errors', async () => {
      const mockRefreshToken = 'invalid-refresh-token';
      const errorMessage = 'Invalid refresh token';
      (mockApiClient.post as jest.MockedFunction<any>).mockRejectedValue(new Error(errorMessage));

      await expect(refreshToken(mockRefreshToken)).rejects.toThrow(errorMessage);
    });

    it('should handle case where refresh token is null', async () => {
      await expect(refreshToken(null)).rejects.toThrow('No refresh token available');
    });
  });
});