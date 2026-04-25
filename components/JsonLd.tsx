/**
 * <JsonLd graph={...} /> — emit one or more JSON-LD payloads into the
 * document head as <script type="application/ld+json">. Server component
 * by default; the script tags are produced at build time and live in the
 * static HTML so crawlers see them without executing JS.
 */
export const JsonLd = ({ graph }: { graph: unknown | unknown[] }) => {
  const items = Array.isArray(graph) ? graph : [graph];
  return (
    <>
      {items.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  );
};
