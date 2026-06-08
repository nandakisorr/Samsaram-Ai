import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { tokenService, userService } from '../utils/token';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshToken: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshToken = () => {
    const storedToken = tokenService.getToken();
    const storedUser = userService.getUser();
    setToken(storedToken);
    setUser(storedUser);
    setIsLoading(false);
  };

  const login = (newToken: string, newUser: User) => {
    tokenService.setToken(newToken);
    userService.setUser(newUser);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    tokenService.removeToken();
    userService.removeUser();
    setToken(null);
    setUser(null);
  };

  // Initialize auth state from storage
  useEffect(() => {
    console.log('AuthProvider: initializing...');
    try {
      const storedToken = tokenService.getToken();
      const storedUser = userService.getUser();
      console.log('Stored token:', storedToken ? 'exists' : 'none');

      // Check if token exists and is not expired
      if (storedToken && !tokenService.isTokenExpired(storedToken)) {
        console.log('Token valid, setting user');
        setToken(storedToken);
        setUser(storedUser);
        } else if (storedToken) {
          console.log('Token expired, clearing');
          tokenService.removeToken();
          userService.removeUser();
        }

      setIsLoading(false);
    } catch (error) {
      console.error('AuthProvider init error:', error);
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !tokenService.isTokenExpired(token),
        isLoading,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
