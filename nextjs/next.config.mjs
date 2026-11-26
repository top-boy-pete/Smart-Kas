/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy.
// The app is a client-only SPA that loads Google Fonts (DM Sans / Manrope) and
// talks to Supabase (auth + RPC + storage) and Cloudinary (signed media
// delivery/upload). Those origins are explicitly allow-listed; everything else
// falls back to 'self'. No external scripts, eval, or geolocation are used.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com https://res.cloudinary.com",
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // Only force HTTPS in production; in dev this would upgrade http://localhost.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // HSTS is only meaningful (and safe) over HTTPS in production.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig = {
  reactStrictMode: true,
  // Security: do not advertise the framework via the X-Powered-By header.
  poweredByHeader: false,
  // Performance: gzip/br compress responses.
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Tree-shake the lucide-react icon barrel to keep the client bundle small.
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Immutable, content-hashed build assets can be cached aggressively.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
