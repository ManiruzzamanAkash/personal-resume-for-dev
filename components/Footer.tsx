import { CONTENT } from '@/lib/content';
import { resolveAction } from '@/lib/actions';

export const Footer = () => {
  const c = CONTENT.footer;
  return (
    <footer className="footer" role="contentinfo" aria-label="Site footer">
      <div>{c.copyright}</div>
      <nav className="footer-links" aria-label="Social links">
        {c.links.map((link) => {
          const a = resolveAction(link.action);
          return (
            <a
              key={link.label}
              href={a.href}
              target={a.target}
              rel={a.rel}
              aria-label={`${CONTENT.site.fullName} on ${link.label}`}
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </footer>
  );
};
