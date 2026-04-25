/* ============================================================
   pages/Blog.jsx — list of articles loaded from /articles/*.md.
   Reads articles via fetchAllArticles() (markdown.js).
   Copy comes from CONTENT.blog in src/data.js.
   ============================================================ */

const BlogPage = () => {
  const c = CONTENT.blog.hero;
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
        <span className="eyebrow">{c.eyebrow}</span>
        <Rich as="h1" text={c.heading} />
        <Rich as="p" className="lede" text={c.lede} />
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
  const c = CONTENT.blog;

  if (error) {
    return <div className="blog-empty">{c.error} {error}</div>;
  }

  if (articles === null) {
    return <div className="blog-loading">{c.loading}</div>;
  }

  if (articles.length === 0) {
    return <div className="blog-empty">{c.empty}</div>;
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
        {c.feedEnd}
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
