import Link from 'next/link';
import { I } from './icons';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Top-of-page breadcrumb trail. Last crumb (no href) renders as the
 * current location. Renders a JSON-LD-friendly visible trail; the
 * machine-readable BreadcrumbList JSON-LD is emitted separately by
 * lib/seo.ts so search results show the same path Google saw.
 */
export const Breadcrumb = ({ items }: { items: Crumb[] }) => {
  if (!items.length) return null;
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className={last ? 'is-current' : ''}>
              {!last && c.href ? (
                <Link href={c.href} data-cursor="hover">{c.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{c.label}</span>
              )}
              {!last && (
                <span className="sep" aria-hidden="true">
                  <I.chevronRight />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
