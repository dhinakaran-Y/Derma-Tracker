import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../hooks/useTheme';
import { AuthProvider } from '../hooks/useAuth';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'DermaTrack — Trichology & Dermatology Clinical ERP & PMS',
  description:
    'Specialized Clinical Enterprise Resource Planning & Practice Management System for Dermatology and Trichology hospitals. Front-desk triage, mobile scalp dermoscopy pairing, Norwood alopecia grading, batch pharmacy fulfillment, and DPDP-compliant patient portal.',
  keywords: [
    'dermatology ERP',
    'trichology clinic software',
    'practice management system',
    'scalp dermoscopy',
    'Norwood scale alopecia',
    'follicular density analysis',
    'clinical PMS',
    'hospital ERP India',
    'GST medical billing',
  ],
  authors: [{ name: 'DermaTrack Clinical Systems' }],
  openGraph: {
    title: 'DermaTrack — Specialized Clinical ERP for Dermatology & Trichology',
    description:
      'Unify your entire patient journey from front-desk triage and wireless mobile dermoscopy pairing to batch pharmacy fulfillment and GST healthcare billing.',
    siteName: 'DermaTrack Clinical ERP',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DermaTrack — Trichology & Dermatology Clinical ERP',
    description:
      'Specialized ERP for high-precision dermatology & trichology practices with zero-install mobile dermoscopy pairing.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                style: {
                  background: '#151C1D',
                  color: '#FFFFFF',
                  border: '1px solid #324145',
                  fontSize: '13px',
                },
                className: '!text-white font-sans shadow-2xl',
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
