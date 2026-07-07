import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diorama",
  description: "Build 3D worlds for your AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
