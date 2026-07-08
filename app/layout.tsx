// @ts-nocheck
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Umbrella Suite',
  description: 'Enterprise ERP & CRM — B2B and B2C, all in one suite.',
  metadataBase: new URL('https://cloud.umbrellasuite.com'),
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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
