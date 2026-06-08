import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { ChatPage } from '@/pages/ChatPage';
import { LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm, UserDropdown } from '@/modules/auth';
import { useAuth } from '@/core/providers/AuthProvider';
import HistoryPage from '@/pages/HistoryPage';
import { ThemeSelector } from '@/modules/theme';
import { useThemeStore } from '@/core/stores/themeStore';
import { ErrorBoundary } from '@/core/error/ErrorBoundary';
import styles from './App.module.css';

function Navbar() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

  // Don't show user menu while loading auth state
  if (isLoading) {
    return (
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.logo}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
               Samsaram ai
            </Link>
          </div>
          <div className={styles.navLinks}>
            <ThemeSelector />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.navContent}>
        <div className={styles.logo}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
             Samsaram ai
          </Link>
        </div>
        <div className={styles.navLinks}>
          {isAuthenticated ? (
            <>
              <Link to="/" className={styles.link}>Chat</Link>
              <UserDropdown
                isOpen={showDropdown}
                onClose={() => setShowDropdown(false)}
                onToggle={() => setShowDropdown(!showDropdown)}
                username={user?.username || 'User'}
              />
              <ThemeSelector />
            </>
          ) : (
            <>
              <Link to="/login" className={styles.link}>Login</Link>
              <Link to="/register" className={styles.link}>Register</Link>
              <ThemeSelector />
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { theme } = useThemeStore();

  // Apply theme CSS custom properties and dark class to document root
  useEffect(() => {
    const root = document.documentElement;

    // Apply theme mode (light/dark) based on system preference or mode selection
    let effectiveTheme = theme.mode;
    if (theme.mode === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = systemDark ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', effectiveTheme);
    root.classList.toggle('dark', effectiveTheme === 'dark');

    // Set dynamic CSS variables for customization
    root.style.setProperty('--gradient-color-1', theme.gradientColors.color1);
    root.style.setProperty('--gradient-color-2', theme.gradientColors.color2);
    root.style.setProperty('--gradient-color-3', theme.gradientColors.color3);
    root.style.setProperty('--gradient-color-4', theme.gradientColors.color4);
    root.style.setProperty('--animation-duration', `${theme.animationDuration}s`);
    root.style.setProperty('--blur-intensity', `${theme.blurIntensity}px`);
    root.style.setProperty('--glass-opacity', String(theme.glassOpacity));
    root.style.setProperty('--bubble-radius', `${theme.bubbleRadius}px`);
    root.style.setProperty('--overlay-color', effectiveTheme === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)');

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.gradientColors.color1);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme.gradientColors.color1;
      document.head.appendChild(meta);
    }
  }, [theme]);

  // Listen for system theme changes when mode is 'system'
  useEffect(() => {
    if (theme.mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const systemDark = mediaQuery.matches;
      document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', systemDark);
      document.documentElement.style.setProperty('--overlay-color', systemDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme.mode]);

  return (
    <BrowserRouter>
      <div className={styles.app}>
        <Navbar />
        <main className={styles.mainContent}>
          <Routes>
            <Route path="/" element={
              <ErrorBoundary>
                <ChatPage />
              </ErrorBoundary>
            } />
            <Route path="/login" element={
              <ErrorBoundary>
                <LoginForm />
              </ErrorBoundary>
            } />
            <Route path="/register" element={
              <ErrorBoundary>
                <RegisterForm />
              </ErrorBoundary>
            } />
            <Route path="/forgot-password" element={
              <ErrorBoundary>
                <ForgotPasswordForm />
              </ErrorBoundary>
            } />
            <Route path="/reset-password" element={
              <ErrorBoundary>
                <ResetPasswordForm />
              </ErrorBoundary>
            } />
            <Route path="/history" element={
              <ErrorBoundary>
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              </ErrorBoundary>
            } />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
