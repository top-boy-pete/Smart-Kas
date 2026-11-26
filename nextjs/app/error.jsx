"use client";

/**
 * Route-segment error boundary (Next.js App Router convention).
 * Rendered inside the root layout, so global styles remain available.
 */
export default function Error({ error, reset }) {
  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div style={styles.wrap} role="alert">
      <div style={styles.card}>
        <p style={styles.eyebrow}>Kasua</p>
        <h1 style={styles.title}>Something went wrong</h1>
        <p style={styles.copy}>The page ran into an unexpected problem.</p>
        <div style={styles.actions}>
          <button type="button" onClick={() => reset()} style={styles.primary}>
            Try again
          </button>
          <button type="button" onClick={handleReload} style={styles.secondary}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
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
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "center",
  },
  primary: {
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
  secondary: {
    minHeight: "44px",
    padding: "0 20px",
    border: "1px solid #e3e9df",
    borderRadius: "5px",
    background: "#ffffff",
    color: "#145536",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
