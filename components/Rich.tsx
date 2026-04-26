import {
  Fragment, createElement,
  type HTMLAttributes, type ElementType, type ReactNode,
} from 'react';
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

interface RichTitleProps extends HTMLAttributes<HTMLElement> {
  text: string;
  className?: string;
  /** Heading level — defaults to <h1>. Pass `as="h2"` for sub-page headings
   *  if you ever need a non-h1. */
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

/**
 * Word-by-word stagger title. Each token gets a per-word
 * `<span class="word">` with an inline animation-delay derived from
 * its index, so the global `.word > span` keyframe in styles/hero.css
 * picks it up automatically. Words flagged with single-asterisks
 * (`*plugin*`) render as <em> for accent color.
 *
 * Forwards through any extra props (itemProp, id, aria-*, style…) so it
 * can be a drop-in replacement for a hand-written <h1>.
 */
export const RichTitle = ({
  text,
  className,
  as = 'h1',
  ...rest
}: RichTitleProps) => {
  if (!text) return null;
  const lines = tmpl(text).split('\n');
  let wordIdx = 0;

  /* Match `<lead>*<inner>*<trail>` where lead/trail are optional punctuation
     that lives outside the italic span. This lets authors write either
     style and get the same visual result:
        "*architect.*"  → punctuation inside the italics
        "*talk*."       → punctuation outside (period stays upright) */
  const ITALIC_TOKEN = /^([^*]*)\*([^*]+)\*([^*]*)$/;

  const children = lines.map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/(\s+)/).map((tok, ti) => {
        if (/^\s*$/.test(tok)) return tok || ' ';

        const m = tok.match(ITALIC_TOKEN);
        const delay = `${0.05 + wordIdx++ * 0.1}s`;

        const content: ReactNode = m
          ? (
              <>
                {m[1]}
                <em>{m[2]}</em>
                {m[3]}
              </>
            )
          : tok;

        return (
          <span key={ti} className="word">
            <span style={{ animationDelay: delay }}>{content}</span>
          </span>
        );
      })}
    </Fragment>
  ));

  return createElement(as, { className, ...rest }, children);
};
