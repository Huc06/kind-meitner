import type { Metadata } from 'next';
import { LandingHome } from '@/components/landing-home';

export const metadata: Metadata = {
  title: { absolute: 'kind-meitner' },
  description: 'OKX agent suite for OKX.ai on OKX Onchain OS and X Layer',
};

export default function HomePage() {
  return <LandingHome />;
}
