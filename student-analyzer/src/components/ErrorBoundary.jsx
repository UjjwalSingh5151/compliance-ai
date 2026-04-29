import { Component } from "react";
import { c } from "../lib/theme";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
          gap: 12,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>
            {this.props.title || "Something went wrong"}
          </div>
          <div style={{ fontSize: 13, color: c.textMid, maxWidth: 400 }}>
            {this.props.description || "This section ran into an error. The rest of the app is still working."}
          </div>
          <details style={{ fontSize: 11, color: c.textDim, maxWidth: 500, textAlign: "left" }}>
            <summary style={{ cursor: "pointer", marginBottom: 6 }}>Error details</summary>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {this.state.error?.message}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ fontSize: 12, color: c.accent, background: c.accentDim, border: `1px solid ${c.accent}40`, borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
