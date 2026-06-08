import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?(): void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary catches JavaScript errors anywhere in the child component tree,
 * logs them to the error-log service, and displays a user-friendly message instead
 * of a blank screen.
 *
 * Use this to wrap page-level components so that a failure in one page doesn't
 * crash the entire application.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console (in real app, send to error-log service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: '#ef4444',
            fontFamily: 'DM Sans, sans-serif',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: '#3b82f6',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
