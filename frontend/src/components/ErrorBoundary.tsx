import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-dark-950 flex flex-col items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-red-200 dark:border-red-900/50 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
            
            <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              Something went wrong
            </h1>
            
            <p className="text-slate-500 dark:text-slate-400 mb-8">
              We've encountered an unexpected error. Our team has been notified. 
              Please try refreshing the page.
            </p>

            {this.state.error && (
              <div className="mb-8 text-left bg-slate-50 dark:bg-dark-950 p-4 rounded-xl border border-slate-100 dark:border-dark-800 overflow-x-auto">
                <code className="text-xs text-red-500 dark:text-red-400 font-mono">
                  {this.state.error.message}
                </code>
              </div>
            )}
            
            <button 
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-xl font-medium transition-colors w-full justify-center"
            >
              <RefreshCcw className="w-5 h-5" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
