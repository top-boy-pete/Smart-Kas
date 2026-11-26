"use client";

import dynamic from "next/dynamic";
import ErrorBoundary from "@/src/components/ErrorBoundary.jsx";

// The application is a client-rendered SPA: it reads window.location.pathname,
// localStorage and the Supabase auth session, so it must not be server rendered.
const App = dynamic(() => import("@/src/App.jsx"), { ssr: false, loading: () => null });

export default function HomePage() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
