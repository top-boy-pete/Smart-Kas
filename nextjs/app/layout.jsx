import "./globals.css";

export const metadata = {
  title: "Kasua | Masaka Market",
  description: "Shop Masaka's trusted local traders with Kasua.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f6ef",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
