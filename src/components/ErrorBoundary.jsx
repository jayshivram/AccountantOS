import React from 'react';

/**
 * Catches render/runtime errors in the subtree so a single broken page can't
 * white-screen the whole app. Shows a recoverable fallback instead. `resetKey`
 * (e.g. the current view) auto-clears the error when the user navigates away.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    // Clear the error when the reset key changes (e.g. user switches page)
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">This page hit an error</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
          The rest of the app is still fine — switch to another page from the menu, or reload. Your data is saved.
        </p>
        {this.state.error?.message && (
          <pre className="mt-3 max-w-md overflow-x-auto text-left text-[11px] text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
            {String(this.state.error.message)}
          </pre>
        )}
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 transition"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
