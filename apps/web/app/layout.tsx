import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewGPT - AI Mock Interviewer",
  description: "Your AI mock interviewer with real personality. Multi-agent architecture, structured feedback.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
