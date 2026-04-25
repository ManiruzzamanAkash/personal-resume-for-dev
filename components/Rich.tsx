import { Fragment, type HTMLAttributes, type ElementType, type ReactNode } from 'react';
import { tmpl } from '@/lib/tmpl';

const RICH_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\n)/g;

interface RichProps extends HTMLAttributes<HTMLElement> {
  text: string | undefined | null;
  as?: ElementType;
}

/**
 * Inline-emphasis renderer. Parses the lib/content.ts micro-format:
 *   *italic*   → <em>
 *   **bold**   → <b>
 *   \n         → <br />
 * `{token}` placeholders are substituted against CONTENT.site via tmpl().
 */
export const Rich = ({ text, as: Tag = 'span', ...rest }: RichProps) => {
  if (text == null) return null;
  const filled = tmpl(String(text));
  const parts = filled.split(RICH_RE).filter((p) => p !== '');
  return (
    <Tag {...rest}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>;
        if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
        if (p === '\n') return <br key={i} />;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </Tag>
  );
};

interface RichTitleProps {
  text: string;
  className?: string;
}

/**
 * Word-by-word stagger for hero titles. Each token gets a per-word
 * <span class="word"> with an animation-delay derived from index, so the
 * existing CSS animations can pick them up.
 */
export const RichTitle = ({ text, className }: RichTitleProps) => {
  if (!text) return null;
  const lines = tmpl(text).split('\n');
  let wordIdx = 0;
  return (
    <h1 className={className}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\s+)/).map((tok, ti) => {
            if (/^\s*$/.test(tok)) return tok || ' ';
            const isItalic = tok.startsWith('*') && tok.endsWith('*');
            const inner = isItalic ? tok.slice(1, -1) : tok;
            const delay = `${0.05 + wordIdx++ * 0.1}s`;
            const node: ReactNode = isItalic ? <em>{inner}</em> : inner;
            return (
              <span key={ti} className="word">
                <span style={{ animationDelay: delay }}>{node}</span>
              </span>
            );
          })}
        </Fragment>
      ))}
    </h1>
  );
};
