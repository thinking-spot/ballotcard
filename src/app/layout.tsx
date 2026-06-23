import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, Open_Sans } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "BallotCard",
    template: "%s — BallotCard",
  },
  description:
    "Enter your address, see everyone who represents you — a faithful recreation of your actual ballot, federal to local, on one permanent page. No account, no ads, no tracking.",
  metadataBase: new URL("https://ballotcard.org"),
  openGraph: {
    siteName: "BallotCard",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
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
      className={`${serif.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
