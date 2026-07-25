// @ts-nocheck
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Umbrella Suite',
  description: 'Enterprise ERP & CRM — B2B and B2C, all in one suite.',
  metadataBase: new URL('https://cloud.umbrellasuite.com'),
  icons: {
    icon: [
      { url: '/umbrella-logo.png', type: 'image/svg+xml' },
      { url: '/umbrella-logo.png', sizes: '32x32' },
      { url: '/umbrella-logo.png', sizes: '16x16' },
    ],
    apple: [{ url: '/umbrella-logo.png' }],
    shortcut: '/umbrella-logo.png',
  },
  openGraph: {
    title: 'Umbrella Suite',
    description: 'Enterprise ERP & CRM — B2B and B2C, all in one suite.',
    url: 'https://cloud.umbrellasuite.com',
    siteName: 'Umbrella Suite',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/umbrella-logo.png"/>
        <link rel="shortcut icon" href="/umbrella-logo.png"/>
        <link rel="apple-touch-icon" href="/umbrella-logo.png"/>
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
