/**
 * Token management utilities
 */

export const TOKEN_KEY = 'auth_token';
export const USER_KEY = 'user';

export const tokenService = {
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  hasToken(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  // Decode JWT payload (without verification - client-side only)
  decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  },

  isTokenExpired(token?: string): boolean {
    const t = token || this.getToken();
    if (!t) return true;

    const decoded = this.decodeToken(t);
    if (!decoded || !decoded.exp) return true;

    // exp is in seconds, Date.now() is in milliseconds
    return Date.now() >= decoded.exp * 1000;
  },
};

export const userService = {
  setUser(user: any): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getUser(): any {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  },

  clearAll(): void {
    tokenService.removeToken();
    this.removeUser();
  },
};
