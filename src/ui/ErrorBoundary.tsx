import { Component, type ReactNode } from 'react';

/** Catches a screen's render errors and offers a way back (as cnc-claude's). */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('UI error', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="kit-desk" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="kit-paper" style={{ maxWidth: 520, padding: '24px 28px', textAlign: 'center', boxShadow: 'var(--kit-shadow-paper)' }}>
          <h2 className="kit-stencil" style={{ margin: '0 0 8px', fontSize: 22 }}>
            Signal lost
          </h2>
          <p style={{ margin: '0 0 10px' }}>Something went wrong while drawing this screen. Return to the menu and try again.</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.6, margin: '0 0 14px' }}>{this.state.error.message}</pre>
          <button
            type="button"
            className="kit-btn kit-btn--primary kit-btn--md"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            <span className="kit-btn__label">Return to menu</span>
          </button>
        </div>
      </div>
    );
  }
}
