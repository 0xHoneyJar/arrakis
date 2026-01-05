import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Arrakis - Engagement Intelligence for Web3 Communities',
  description:
    'Know your community, not just your holders. Conviction scoring, 9-tier progression, and zero-risk adoption. Built by the #1 Dune Analytics team.',
  openGraph: {
    title: 'Arrakis - Engagement Intelligence for Web3 Communities',
    description:
      'Know your community, not just your holders. Conviction scoring, 9-tier progression, and zero-risk adoption.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-stone-50 font-sans">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
