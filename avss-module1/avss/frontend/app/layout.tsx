import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVSS - Autonomous Video Surveillance System",
  description: "AI-powered video surveillance for missing persons detection",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
