import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../hooks/useTheme';
import { AuthProvider } from '../hooks/useAuth';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'DermaTrack — Trichology & Dermatology Clinic System',
  description: 'Comprehensive clinical ERP and patient portal for trichology and dermatology clinics.',
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
