import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[App] Render failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen flex items-center justify-center p-6 text-center theme-error-page"><div className="glass-panel max-w-sm p-6"><h1 className="text-lg font-semibold text-white">页面出现异常</h1><p className="text-sm text-gray-400 mt-2">请刷新页面后重试；语音连接会自动断开。</p><button onClick={() => window.location.reload()} className="mt-4 bg-primary-600 hover:bg-primary-500 text-white text-sm px-4 py-2 rounded-lg">刷新页面</button></div></div>;
    }
    return this.props.children;
  }
}
