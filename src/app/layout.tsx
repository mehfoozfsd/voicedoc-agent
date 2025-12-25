import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import DatadogInit from '@/components/DatadogInit';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VoiceDoc Agent',
  description: 'Voice-native document intelligence',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <DatadogInit />
        {children}
      </body>
    </html>
  );
}
