import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Friendly Stakes",
  description: "Place friendly wagers with your crew",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
