/* ============================================================
   pages/Article.jsx — Single article view.
   Loads /articles/<slug>.md, parses frontmatter, renders body.
   ============================================================ */

const ArticlePage = ({ slug }) => {
  const [state, setState] = React.useState({ status: 'loading' });
  const proseRef = React.useRef(null);

  React.useEffect(() => {
    if (!slug) {
      setState({ status: 'error', message: 'No article specified.' });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Resolve slug -> filename via the index (slugs may differ from filenames).
        const filenames = await fetchArticleIndex();
        const candidate = filenames.find(n => n.replace(/\.md$/, '') === slug)
                       || `${slug}.md`;

        const article = await fetchArticle(candidate);
        if (!cancelled) setState({ status: 'ok', article });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: err.message });
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  React.useEffect(() => {
    if (state.status === 'ok' && proseRef.current) {
      enhanceCodeBlocks(proseRef.current);
    }
  }, [state]);

  if (state.status === 'loading') {
    return (
      <>
        <article className="article">
          <div className="blog-loading">{CONTENT.blog.loading}</div>
        </article>
        <Footer />
      </>
    );
  }

  if (state.status === 'error') {
    return (
      <>
        <div className="article-error">
          <h2>{CONTENT.article.notFoundHead}</h2>
          <p>{state.message}</p>
          <a className="btn btn-ghost"
             href="#/blog"
             onClick={(e) => { e.preventDefault(); navTo('blog'); }}
             data-cursor="hover">
            <I.arrowLeft /> {CONTENT.article.backLabel}
          </a>
        </div>
        <Footer />
      </>
    );
  }

  const { meta, html } = state.article;

  return (
    <>
      <article className="article">
        <div className="article-meta">
          {meta.category && <span className="cat">{meta.category}</span>}
          {meta.category && meta.date && <span className="dot" />}
          {meta.date && <span>{formatLongDate(meta.date)}</span>}
          {meta.readTime && <span className="dot" />}
          {meta.readTime && <span>{meta.readTime} read</span>}
        </div>

        <h1 className="article-title">{meta.title}</h1>

        {meta.excerpt && <p className="article-excerpt">{meta.excerpt}</p>}

        <div className="prose" ref={proseRef} dangerouslySetInnerHTML={{ __html: html }} />

        <div className="article-footer">
          <a className="btn btn-ghost"
             href="#/blog"
             onClick={(e) => { e.preventDefault(); navTo('blog'); }}
             data-cursor="hover">
            <I.arrowLeft /> {CONTENT.article.backLabel}
          </a>
          <a className="btn btn-primary"
             href={`mailto:${SITE.email}?subject=${encodeURIComponent('Re: ' + meta.title)}`}
             data-cursor="hover">
            {CONTENT.article.replyLabel} <span className="arrow"><I.arrow /></span>
          </a>
        </div>
      </article>
      <Footer />
    </>
  );
};

/** Format an ISO date as e.g. "April 25, 2026". */
const formatLongDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/* ---------- Code-block enhancements: copy button + syntax highlighting ---------- */

/**
 * Wrap each <pre> in a .code-block container, add a copy button + language tag,
 * then run Prism over the wrapped block.
 */
const enhanceCodeBlocks = (root) => {
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-block')) return;

    const code = pre.querySelector('code');
    const langClass = code?.className.match(/language-([\w-]+)/);
    const lang = langClass ? langClass[1] : '';

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.parentElement.insertBefore(wrapper, pre);
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

  if (window.Prism) window.Prism.highlightAllUnder(root);
};

const copyCode = (codeEl, btn) => {
  const text = codeEl?.textContent || '';
  const done = () => {
    const label = btn.querySelector('.code-copy-label');
    if (!label) return;
    const original = label.textContent;
    label.textContent = 'Copied';
    btn.classList.add('is-copied');
    setTimeout(() => {
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

const fallbackCopy = (text, done) => {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch {}
  document.body.removeChild(ta);
};

window.ArticlePage = ArticlePage;
