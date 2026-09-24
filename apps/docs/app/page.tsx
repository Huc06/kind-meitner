import type { Metadata } from 'next';
import { LandingHome } from '@/components/landing-home';

export const metadata: Metadata = {
  title: { absolute: 'kind-meitner' },
  description: 'AI-Native Agent Suite & Autonomous Commerce Operating System for OKX.ai',
};

export default function HomePage() {
  return <LandingHome />;
}
