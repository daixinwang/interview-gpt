import type { Metadata } from "next";
import "./globals.css";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "InterviewGPT - AI Mock Interviewer",
  description:
    "Your AI mock interviewer with real personality. Multi-agent architecture, structured feedback.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply theme before first paint to avoid flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="bg-background antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
