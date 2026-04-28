import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://timer.marques.llc"),
  title: {
    default: "Timer",
    template: "%s | Timer"
  },
  description: "Internal time tracking and invoicing for marques.llc.",
  openGraph: {
    type: "website",
    siteName: "Timer",
    title: "Timer",
    description: "Internal time tracking and invoicing for marques.llc.",
    url: "https://timer.marques.llc"
  },
  twitter: {
    card: "summary_large_image",
    title: "Timer",
    description: "Internal time tracking and invoicing for marques.llc."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={ibmPlexMono.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
