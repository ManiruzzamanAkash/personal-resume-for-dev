import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { I } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main">
        <div className="article-error" style={{ padding: '120px 24px', textAlign: 'center' }}>
          <h1>Page not found</h1>
          <p>The page you're looking for doesn't exist — or has been moved.</p>
          <Link className="btn btn-ghost" href="/" data-cursor="hover">
            <I.arrowLeft /> Back home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
