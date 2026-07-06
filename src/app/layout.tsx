import type { Metadata, Viewport } from "next";
import {
  Libre_Baskerville,
  Open_Sans,
  Inter,
  IBM_Plex_Sans,
} from "next/font/google";
import "./globals.css";

const serif = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
  display: "swap",
});

// Inter powers the "chrome" layer (nav, page background, headers, footer) —
// the 2026-iPad-OS world that the paper ballot card floats on top of.
const sansUi = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-ui",
  display: "swap",
});

// IBM Plex Sans is reserved for the wordmark alone — the brand mark in the nav
// and footer (paired with the ballot-checkbox icon).
const wordmark = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-wordmark",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    // SEO templates: every per-page title sets the "[X] Sample Ballots / Ballot
    // & Election Info" lead and the template appends the brand suffix. Pages
    // that need a fully-controlled title (homepage, /card) set title.absolute.
    default: "Find My Ballot | Sample Ballots & Election Info | BallotCard",
    template: "%s | Find Your Ballot",
  },
  description:
    "Create an online version of your local ballot in seconds. From the senate to city hall, stay up to date on your representatives and your elections, 24/7.",
  metadataBase: new URL("https://ballot-card.com"),
  // "./" resolves against metadataBase + the current route, so every page emits
  // its own query-param-free canonical without per-page boilerplate.
  alternates: {
    canonical: "./",
  },
  openGraph: {
    siteName: "BallotCard",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Google Search Console ownership — set GOOGLE_SITE_VERIFICATION in Vercel
  // (the content value of the meta-tag verification method).
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${sansUi.variable} ${wordmark.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
