import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareOps Sentinel Console",
  description: "Clinical AI safety command center for FHIR-aware healthcare agents."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
