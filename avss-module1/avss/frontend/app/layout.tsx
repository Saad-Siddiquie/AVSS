import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AVSS – Autonomous Video Surveillance System", template: "%s – AVSS" },
  description: "AI-powered missing person detection for indoor spaces.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
