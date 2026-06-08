import { Component } from "react";

/**
 * Global React Error Boundary.
 *
 * Catches unhandled errors in the component tree and shows a
 * user-friendly fallback instead of a white screen. Never leaks
 * stack traces or internal details to the user in production.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true, errorId: Date.now().toString(36) };
  }

  componentDidCatch(error, errorInfo) {
    // Log full details for debugging — only visible in browser console
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Caught error:", error);
      console.error("[ErrorBoundary] Component stack:", errorInfo?.componentStack);
    } else {
      // In production, log a minimal fingerprint (no stack traces)
      console.error(`[ErrorBoundary] Error ID: ${this.state.errorId}`);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, errorId: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#121214",
          fontFamily: "'Poppins', sans-serif",
          padding: 20,
        }}>
          <div style={{
            background: "#1E2025",
            borderRadius: 18,
            padding: "40px 36px",
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            border: "1px solid #2e3036",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#FFFFFF",
              marginBottom: 8,
            }}>
              Something went wrong
            </div>
            <div style={{
              fontSize: 14,
              color: "#94A3B8",
              lineHeight: 1.6,
              marginBottom: 24,
            }}>
              An unexpected error occurred. Your data is safe —
              please reload to continue.
            </div>
            <button
              onClick={this.handleReload}
              style={{
                background: "#10B981",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
                transition: "background 0.15s",
              }}
              onMouseOver={e=>e.currentTarget.style.background="#059669"}
              onMouseOut={e=>e.currentTarget.style.background="#10B981"}
            >
              Reload Receiva
            </button>
            <div style={{
              marginTop: 16,
              fontSize: 11,
              color: "#94A3B8",
            }}>
              Error ref: {this.state.errorId}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
