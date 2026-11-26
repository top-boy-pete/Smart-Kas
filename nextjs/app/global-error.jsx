"use client";

/**
 * Last-resort error boundary. Triggered only when the root layout itself fails,
 * so it must render its own <html> and <body> elements.
 */
export default function GlobalError({ error, reset }) {
  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#fbfcf8",
          color: "#18251e",
          fontFamily: '"DM Sans", sans-serif',
        }}
      >
        <div
          role="alert"
          style={{
            width: "min(460px, 100%)",
            padding: "28px",
            border: "1px solid #e3e9df",
            borderRadius: "8px",
            background: "#ffffff",
            boxShadow: "0 16px 40px rgba(32, 54, 39, .08)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#1c7548",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Kasua
          </p>
          <h1
            style={{
              margin: "10px 0 0",
              fontFamily: '"Manrope", sans-serif',
              fontSize: "24px",
              lineHeight: 1.2,
            }}
          >
            Something went wrong
          </h1>
          <p style={{ margin: "10px 0 20px", color: "#69756c", fontSize: "13px", lineHeight: 1.5 }}>
            The application failed to start. Reload to try again.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: "44px",
                padding: "0 20px",
                border: 0,
                borderRadius: "5px",
                background: "#d8ec82",
                color: "#203521",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={handleReload}
              style={{
                minHeight: "44px",
                padding: "0 20px",
                border: "1px solid #e3e9df",
                borderRadius: "5px",
                background: "#ffffff",
                color: "#145536",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
