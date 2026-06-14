import type { Metadata } from "next";
import "./globals.css";
import DiscoveryMenu from "@/components/DiscoveryMenu";

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
        <DiscoveryMenu />
      </body>
    </html>
  );
}
