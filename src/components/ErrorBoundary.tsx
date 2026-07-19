import React from 'react';

/** All ShiftSync persistence lives under this prefix (shifts, templates, targets, dark mode). */
const STORAGE_KEY_PREFIX = 'shiftsync.';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // The project has no @types/react, so the inferred base class doesn't expose `props`.
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info);
  }

  handleReset = () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) keys.push(key);
      }
      keys.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('Failed to clear stored data.', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 text-slate-900 p-6 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-slate-500 max-w-md leading-relaxed">
            The app hit an unexpected error. Resetting your saved data (shifts, templates, and
            preferences) usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
          >
            Reset data
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
