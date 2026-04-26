'use client';

import { useEffect, useRef } from 'react';

interface Props {
  html: string;
}

/**
 * Renders the article's pre-rendered HTML and post-processes it on mount:
 *   - Wraps every <pre> in a `.code-block` container
 *   - Injects a language tag (from the `language-xxx` class)
 *   - Injects a "Copy" button that copies the block's text to clipboard
 *
 * This has to be a client component because the markdown HTML arrives
 * fully rendered from the server, but the copy button needs DOM event
 * handlers and clipboard access.
 */
export const ArticleProse = ({ html }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    enhanceCodeBlocks(root);
  }, [html]);

  return (
    <div
      ref={ref}
      className="prose"
      itemProp="articleBody"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

/* ---------- DOM-level enhancement ---------- */

const enhanceCodeBlocks = (root: HTMLElement) => {
  root.querySelectorAll('pre').forEach((pre) => {
    /* Idempotent: if we've already wrapped this <pre>, bail. */
    if (pre.parentElement?.classList.contains('code-block')) return;

    const code = pre.querySelector('code');
    const langMatch = code?.className.match(/language-([\w-]+)/);
    const lang = langMatch ? langMatch[1] : '';

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.parentElement?.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    if (lang) {
      const tag = document.createElement('span');
      tag.className = 'code-lang';
      tag.textContent = lang;
      wrapper.appendChild(tag);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = '<span class="code-copy-label">Copy</span>';
    btn.addEventListener('click', () => copyCode(code, btn));
    wrapper.appendChild(btn);
  });
};

const copyCode = (codeEl: Element | null, btn: HTMLButtonElement) => {
  const text = codeEl?.textContent ?? '';
  const done = () => {
    const label = btn.querySelector('.code-copy-label') as HTMLElement | null;
    if (!label) return;
    const original = label.textContent ?? 'Copy';
    label.textContent = 'Copied';
    btn.classList.add('is-copied');
    window.setTimeout(() => {
      label.textContent = original;
      btn.classList.remove('is-copied');
    }, 1600);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
};

/* execCommand fallback for older browsers / non-secure contexts. */
const fallbackCopy = (text: string, done: () => void) => {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    /* execCommand is deprecated but remains the only fallback for
       non-secure contexts (file://, http://) where Clipboard API is
       blocked. Cast away the deprecation warning. */
    (document as { execCommand?: (cmd: string) => boolean }).execCommand?.('copy');
    done();
  } catch {
    /* swallow — best-effort */
  }
  document.body.removeChild(ta);
};
