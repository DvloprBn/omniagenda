import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'OmniAgenda', template: '%s' },
  description: 'Motor de agenda y reservaciones',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased" style={{ background: 'var(--paper)', color: 'var(--ink-900)' }}>
        {children}
      </body>
    </html>
  );
}
