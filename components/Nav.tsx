'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CONTENT } from '@/lib/content';
import { pathFor } from '@/lib/routing';
import { useTheme } from '@/lib/theme';
import { I } from './icons';
import type { RouteId } from '@/lib/content';

/** Map a Next.js pathname back to a CONTENT.navigation route id so the
   active-link styling matches the URL. */
const activeRouteFor = (pathname: string | null): RouteId => {
  if (!pathname || pathname === '/') return 'home';
  if (pathname.startsWith('/resume'))  return 'resume';
  if (pathname.startsWith('/blog'))    return 'blog';
  if (pathname.startsWith('/contact')) return 'contact';
  if (pathname.startsWith('/article')) return 'blog';
  return 'home';
};

export const Nav = () => {
  const pathname = usePathname();
  const route = activeRouteFor(pathname);
  const { theme, setTheme, mounted } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Close mobile menu when route changes. */
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  /* Lock body scroll while menu is open. */
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);

  return (
    <nav
      className={`nav ${scrolled ? 'scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}
      aria-label="Primary navigation"
    >
      <Link
        className="nav-logo"
        href={pathFor('home')}
        aria-label={`${CONTENT.site.fullName} — home`}
        rel="home"
      >
        <span className="nav-logo-avatar" aria-hidden="true">
          <img
            src="/assets/akash-avatar.jpg"
            alt=""
            width={28}
            height={28}
            loading="eager"
            decoding="async"
          />
        </span>
        {CONTENT.site.short}
      </Link>

      <div id="primary-nav" className={`nav-links ${menuOpen ? 'is-open' : ''}`} role="menubar">
        {CONTENT.navigation.map((l) => (
          <Link
            key={l.id}
            href={pathFor(l.id)}
            role="menuitem"
            aria-current={route === l.id ? 'page' : undefined}
            className={`nav-link ${route === l.id ? 'active' : ''} ${mounted && theme === 'dark' ? 'is-dark' : ''}`}
          >
            {route === l.id && (
              /* `suppressHydrationWarning` here because the pill's background
                 depends on theme, which we only know post-mount. We render
                 the light variant on the server to match the html[data-theme]
                 baseline and let the inline pre-hydration script + this
                 effect-driven re-render catch up. */
              <span
                className="pill"
                aria-hidden="true"
                suppressHydrationWarning
                style={{ background: mounted && theme === 'dark' ? '#fafafa' : '#0a0a0a' }}
              />
            )}
            <span>{l.label}</span>
          </Link>
        ))}
      </div>

      <div className="nav-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={mounted && theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          suppressHydrationWarning
        >
          {/* Render the moon (matches `data-theme="light"` baseline) on first
             paint; swap to sun once we know the actual theme post-mount. */}
          {mounted && theme === 'dark' ? <I.sun /> : <I.moon />}
        </button>
        <button
          type="button"
          className="icon-btn nav-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
        >
          {menuOpen ? <I.close /> : <I.menu />}
        </button>
      </div>
    </nav>
  );
};
