import { CONTENT, SITE } from './content';

/**
 * Substitute {key} and {nested.key} placeholders against CONTENT.site.
 * Used by every page that renders copy authored in lib/content.ts.
 */
export const tmpl = (str: string | undefined | null): string => {
  if (!str || typeof str !== 'string') return str ?? '';
  return str.replace(/\{([^}]+)\}/g, (m, path: string) => {
    const segs = path.split('.');
    let v: any = SITE;
    for (const s of segs) {
      if (v == null) return m;
      v = v[s];
    }
    return v == null ? m : String(v);
  });
};

/** Same as tmpl but takes an extra fallback object — used for article meta. */
export const tmplWith = (str: string | undefined | null, extra: Record<string, string | undefined>): string => {
  if (!str || typeof str !== 'string') return str ?? '';
  return tmpl(
    str.replace(/\{([^}]+)\}/g, (m, key: string) => {
      const v = extra[key];
      return v == null ? m : String(v);
    })
  );
};
