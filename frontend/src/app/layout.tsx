import './globals.css';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit'
});

export const metadata = {
  title: 'GitHub Automation Bot Dashboard',
  description: 'Event-Driven GitHub Automation Platform with Live Analytics and Webhook Observability.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={outfit.className}>
      <body>
        {children}
      </body>
    </html>
  );
}
