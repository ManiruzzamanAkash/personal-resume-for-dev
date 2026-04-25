/* ============================================================
   pages/Blog.jsx — list of articles loaded from /articles/*.md.
   Reads articles via fetchAllArticles() (markdown.js).
   ============================================================ */

const BlogPage = () => {
  const [articles, setArticles] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    fetchAllArticles()
      .then(setArticles)
      .catch(err => { console.error(err); setError(err.message); });
  }, []);

  return (
    <>
      <section className="subhero">
        <span className="eyebrow">Writing</span>
        <h1>Notes on <em>building</em> for the long haul.</h1>
        <p className="lede">
          Essays, deep-dives, and the occasional rant — across WordPress, Laravel,
          React, AI, software architecture, and whatever I'm learning lately.
        </p>
      </section>

      <section className="page" style={{ paddingTop: 40 }}>
        <Reveal>
          <BlogList articles={articles} error={error} />
        </Reveal>
      </section>
      <Footer />
    </>
  );
};

const BlogList = ({ articles, error }) => {
  if (error) {
    return (
      <div className="blog-empty">
        Couldn't load articles. {error}
      </div>
    );
  }

  if (articles === null) {
    return <div className="blog-loading">LOADING…</div>;
  }

  if (articles.length === 0) {
    return (
      <div className="blog-empty">
        No articles yet. Add one in <code>articles/</code> and list it in <code>articles/index.json</code>.
      </div>
    );
  }

  return (
    <>
      <div className="blog-list">
        {articles.map((a) => (
          <a key={a.meta.slug}
             className="blog-row"
             href={`#/article/${a.meta.slug}`}
             data-cursor="hover"
             onClick={(e) => { e.preventDefault(); navTo('article', a.meta.slug); }}>
            <span className="date">{formatDate(a.meta.date)}</span>
            <div>
              <div className="title">{a.meta.title}</div>
              {a.meta.excerpt && <div className="excerpt">{a.meta.excerpt}</div>}
            </div>
            <span className="cat">{a.meta.category || ''}</span>
            <span className="arr"><I.arrowUp /></span>
          </a>
        ))}
      </div>
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>
        END OF FEED
      </div>
    </>
  );
};

/** Format an ISO-ish date as "YYYY — MM" for the blog list. */
const formatDate = (iso) => {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return m ? `${y} — ${m}` : y;
};

window.BlogPage = BlogPage;
