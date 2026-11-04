import Link from 'next/link';
import { CONTENT } from '@/lib/content';
import { Rich } from '@/components/Rich';
import { tmpl } from '@/lib/tmpl';
import { I } from '@/components/icons';

/**
 * "Who wrote this" card rendered under every article.
 *
 * Lives in the template — not in each markdown file — so the hiring
 * call-to-action stays consistent across every post and changes in one
 * place (CONTENT.article.authorCard).
 */
export const ArticleAuthorCard = () => {
  const { authorCard } = CONTENT.article;
  const { site } = CONTENT;

  return (
    <aside className="article-author" aria-label="About the author">
      <img
        className="article-author-avatar"
        src="/assets/akash-avatar.jpg"
        alt={site.fullName}
        width={72}
        height={72}
        loading="lazy"
      />
      <div className="article-author-body">
        <span className="article-author-eyebrow">{authorCard.eyebrow}</span>
        <h2 className="article-author-name">{tmpl(authorCard.heading)}</h2>
        <Rich as="p" className="article-author-text" text={authorCard.body} />
        <div className="article-author-actions">
          <a
            className="btn btn-primary"
            href={site.calendly}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="hover"
          >
            {authorCard.ctaPrimary} <span className="arrow"><I.arrow /></span>
          </a>
          <Link className="btn btn-ghost" href="/resume/" data-cursor="hover">
            {authorCard.ctaSecondary}
          </Link>
        </div>
      </div>
    </aside>
  );
};
