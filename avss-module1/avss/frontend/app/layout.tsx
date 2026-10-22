import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVSS — Autonomous Video Surveillance System",
  description: "AI-powered CCTV person search using face recognition, ByteTrack and ArcFace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
