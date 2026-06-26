// @ts-nocheck
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Business Pro ERP',
  description: 'Enterprise Resource Planning',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
