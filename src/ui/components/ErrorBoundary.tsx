import { Component, type ReactNode } from 'react';

/**
 * Last line of defence: a bug in one page shows a friendly message with a way
 * back instead of a blank screen in front of a class.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('PocketLab crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="prose crash" role="alert">
        <h1>Something went wrong</h1>
        <p>
          This page hit an unexpected error. Your saved trials are kept on this device. Going back and opening the page
          again usually helps.
        </p>
        <p className="hint">Details: {this.state.error.message}</p>
        <p>
          <button
            className="primary"
            onClick={() => {
              window.location.hash = '#/';
              this.setState({ error: null });
            }}
          >
            Back to experiments
          </button>{' '}
          <button onClick={() => window.location.reload()}>Reload</button>
        </p>
      </div>
    );
  }
}
