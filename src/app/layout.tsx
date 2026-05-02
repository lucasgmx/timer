import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

const appName = "Marques & Co.";
const appDescription = "Internal time tracking and invoicing for marques.llc.";
const favicon = {
  url: "/favicon.png",
  type: "image/png",
  sizes: "1254x1254"
};
const socialImage = {
  url: favicon.url,
  width: 1254,
  height: 1254,
  alt: appName
};

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://timer.marques.llc"),
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`
  },
  description: appDescription,
  manifest: "/site.webmanifest",
  icons: {
    icon: [favicon],
    shortcut: [favicon],
    apple: [favicon]
  },
  openGraph: {
    type: "website",
    siteName: appName,
    title: appName,
    description: appDescription,
    url: "https://timer.marques.llc",
    images: [socialImage]
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: appDescription,
    images: [socialImage]
  },
  other: {
    thumbnail: favicon.url,
    "msapplication-TileImage": favicon.url,
    "msapplication-TileColor": "#090a0b"
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
