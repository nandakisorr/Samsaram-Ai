import apiClient from '@/core/api/client';
import { 
  LoginRequest, TokenResponse, UserResponse, RegisterRequest,
  ForgotPasswordRequest, ResetPasswordResponse, PasswordResetTokenResponse
} from '@/core/types';

export const authService = {
  async login(username: string, password: string): Promise<{ token: string; user: UserResponse }> {
    console.log('authService.login: attempting login for', username);
    try {
      const data: LoginRequest = { username, password };
    const response = await apiClient.handleResponse(
      apiClient.post<TokenResponse>('/api/v1/auth/login', data)
    );
      console.log('authService.login: success', response);

      // Decode token to get user info
      const token = response.access_token;
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));

      return {
        token,
        user: {
          username: decoded.sub || username,
        },
      };
    } catch (error: any) {
      console.error('authService.login: failed', error);
      throw error;
    }
  },

  async register(username: string, email: string, password: string, dateOfBirth?: string, confirmPassword?: string): Promise<UserResponse> {
    console.log('authService.register: attempting registration for', username);
    try {
      const data: RegisterRequest = { username, email, password, date_of_birth: dateOfBirth, confirm_password: confirmPassword };
      const response = await apiClient.handleResponse(
        apiClient.post<UserResponse>('/api/v1/auth/register', data)
      );
      console.log('authService.register: success', response);
      return response;
    } catch (error: any) {
      console.error('authService.register: failed', error);
      throw error;
    }
  },

  async getMe(): Promise<UserResponse> {
    return await apiClient.handleResponse(
      apiClient.get<UserResponse>('/api/v1/auth/me')
    );
  },

  async logout(): Promise<void> {
    // Client-side logout - just clear storage
    // Backend doesn't need to know (stateless JWT)
  },

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    console.log('authService.requestPasswordReset: for', email);
    try {
      const data: ForgotPasswordRequest = { email };
      const response = await apiClient.handleResponse(
        apiClient.post<{ message: string; success: boolean }>('/api/v1/auth/request-reset', data)
      );
      console.log('authService.requestPasswordReset: success', response);
      return response;
    } catch (error: any) {
      console.error('authService.requestPasswordReset: failed', error);
      // Return generic success to prevent email enumeration
      return { success: true, message: 'If an account exists with this email, a reset link has been sent.' };
    }
  },

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<ResetPasswordResponse> {
    console.log('authService.resetPassword: resetting password');
    try {
      const data: ResetPasswordRequest = { token, new_password: newPassword, confirm_password: confirmPassword };
      const response = await apiClient.handleResponse(
        apiClient.post<ResetPasswordResponse>('/api/v1/auth/reset-password', data)
      );
      console.log('authService.resetPassword: success', response);
      return response;
    } catch (error: any) {
      console.error('authService.resetPassword: failed', error);
      throw error;
    }
  },

  async verifyResetToken(token: string): Promise<PasswordResetTokenResponse> {
    console.log('authService.verifyResetToken: verifying token');
    try {
      const response = await apiClient.handleResponse(
        apiClient.get<PasswordResetTokenResponse>(`/api/v1/auth/verify-reset-token/${token}`)
      );
      console.log('authService.verifyResetToken:', response);
      return response;
    } catch (error: any) {
      console.error('authService.verifyResetToken: failed', error);
      throw error;
    }
  },
};

export default authService;
