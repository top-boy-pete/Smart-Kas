"use client";

import { Component } from "react";

/**
 * Reusable client-side error boundary.
 *
 * The marketing/admin application is a client-rendered SPA that is dynamically
 * imported with `ssr: false`, so an uncaught render error inside it would
 * otherwise blank the whole page. This boundary catches those errors and shows
 * a minimal, on-brand fallback without altering the application's markup,
 * styling or behaviour in the happy path.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Surface the error to the console / monitoring hooks without crashing the app.
    if (typeof console !== "undefined" && typeof console.error === "function") {
      console.error("[Kasua] Unhandled UI error:", error, info?.componentStack);
    }
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={styles.wrap} role="alert">
        <div style={styles.card}>
          <p style={styles.eyebrow}>Kasua</p>
          <h1 style={styles.title}>Something went wrong</h1>
          <p style={styles.copy}>
            The page ran into an unexpected problem. Reload to try again.
          </p>
          <button type="button" onClick={this.handleReload} style={styles.button}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "#fbfcf8",
    color: "#18251e",
    fontFamily: '"DM Sans", sans-serif',
  },
  card: {
    width: "min(460px, 100%)",
    padding: "28px",
    border: "1px solid #e3e9df",
    borderRadius: "8px",
    background: "#ffffff",
    boxShadow: "0 16px 40px rgba(32, 54, 39, .08)",
    textAlign: "center",
  },
  eyebrow: {
    margin: 0,
    color: "#1c7548",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  title: {
    margin: "10px 0 0",
    fontFamily: '"Manrope", sans-serif',
    fontSize: "24px",
    lineHeight: 1.2,
  },
  copy: {
    margin: "10px 0 20px",
    color: "#69756c",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  button: {
    minHeight: "44px",
    padding: "0 20px",
    border: 0,
    borderRadius: "5px",
    background: "#d8ec82",
    color: "#203521",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
