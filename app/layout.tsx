import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalorien-Tracker",
  description: "Verfolge deine Ernährung und dein Gewichtsziel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
