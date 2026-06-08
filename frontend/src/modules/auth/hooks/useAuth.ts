import { useAuth } from '@/core/providers/AuthProvider';
import { useCallback } from 'react';
import { LoginCredentials, RegisterCredentials, ForgotPasswordCredentials, ResetPasswordCredentials } from '../types';
import authService from '../services/authService';

export function useLogin() {
  const { login: setAuth } = useAuth();

  return useCallback(
    async (credentials: LoginCredentials) => {
      const result = await authService.login(credentials.username, credentials.password);
      setAuth(result.token, result.user);
      return result;
    },
    [setAuth]
  );
}

export function useRegister() {
  return useCallback(
    async (credentials: RegisterCredentials) => {
      return await authService.register(
        credentials.username,
        credentials.email,
        credentials.password,
        credentials.dateOfBirth,
        credentials.confirmPassword
      );
    },
    []
  );
}

export function useLogout() {
  const { logout } = useAuth();

  return useCallback(async () => {
    await authService.logout();
    logout();
  }, [logout]);
}

export function useAuthState() {
  const auth = useAuth();

  return {
    user: auth.user,
    token: auth.token,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
  };
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return { authenticated: false, loading: true };
  }

  return {
    authenticated: isAuthenticated,
    loading: false,
  };
}

export function useRequestPasswordReset() {
  return useCallback(
    async (email: string) => {
      return await authService.requestPasswordReset(email);
    },
    []
  );
}

export function useResetPassword() {
  return useCallback(
    async (token: string, newPassword: string, confirmPassword: string) => {
      return await authService.resetPassword(token, newPassword, confirmPassword);
    },
    []
  );
}

export function useVerifyResetToken() {
  return useCallback(
    async (token: string) => {
      return await authService.verifyResetToken(token);
    },
    []
  );
}
