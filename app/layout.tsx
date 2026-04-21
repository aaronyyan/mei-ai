import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mei AI',
  description: 'Clean AI chat workspace built with Next.js and Vercel AI SDK.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
