import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppSidebar from './AppSidebar';

export const metadata: Metadata = {
  title: 'IIVKIS – Operations Portal',
  description: 'Intelligent IT Vendor Knowledge Integration System — Operations Portal',
  icons: {
    icon: '/iivkis-logo-nav.svg',
    shortcut: '/iivkis-logo-nav.svg',
    apple: '/iivkis-logo-nav.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#00d4ff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="app-layout">
          <AppSidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
