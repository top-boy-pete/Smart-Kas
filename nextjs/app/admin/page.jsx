"use client";

import dynamic from "next/dynamic";
import ErrorBoundary from "@/src/components/ErrorBoundary.jsx";

// The /admin route mirrors the original window.location.pathname === "/admin" check.
// App() reads the pathname itself to decide between the staff sign-in screen and the
// demo control center, so both routes render the same client-only application.
const App = dynamic(() => import("@/src/App.jsx"), { ssr: false, loading: () => null });

export default function AdminPage() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
