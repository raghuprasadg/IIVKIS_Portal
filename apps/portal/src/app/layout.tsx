import type { Metadata } from 'next';
import './globals.css';
import AppSidebar from './AppSidebar';

export const metadata: Metadata = {
  description: 'Intelligent IT Vendor Knowledge Integration System — Operations Portal',
  themeColor: '#00d4ff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#00d4ff" />
      </head>
      <body>
        <div className="app-layout">
          <AppSidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
