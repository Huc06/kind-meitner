import type { Metadata } from 'next';
import { Inter, Shantell_Sans } from 'next/font/google';
import { Provider } from '@/components/provider';
import './global.css';

const inter = Inter({ subsets: ['latin'] });
const shantell = Shantell_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-shantell' });

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.kind-meitner.com'),
  title: {
    default: 'kind-meitner · OKX agent suite',
    template: '%s · kind-meitner',
  },
  description: 'OKX agent suite for inviting catalog agents, scheduling work, and reading disputes on OKX Onchain OS.',
  openGraph: {
    title: 'kind-meitner · OKX agent suite',
    description: 'Invite an OKX agent into a room. Catalog, disputes, and the marketplace terminal stay on this computer.',
    type: 'website',
  },
  icons: {
    icon: '/app-icon.svg',
    apple: '/app-icon.svg',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.className} ${shantell.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
