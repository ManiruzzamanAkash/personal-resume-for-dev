const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Fully static output for production builds. Every route is pre-rendered
     to HTML at build time and served as flat files — no Node runtime
     required. Drop the `out/` directory on any static host (Vercel
     auto-detects it).

     We deliberately *don't* set `output: 'export'` in dev. Next.js 14's
     dev server has a long-standing quirk where dynamic routes with
     `generateStaticParams` + `dynamicParams: false` falsely report
     "missing generateStaticParams()" on direct URL hits, even though
     the function is exported. Skipping export in dev sidesteps that
     entirely; the production build still locks routes to the static
     param set. */
  ...(isProd ? { output: 'export' } : {}),

  /* Static export disables Next's image optimizer, which needs a server.
     Our images are small SVGs / PNGs already; no optimizer needed. */
  images: { unoptimized: true },

  /* `trailingSlash: true` makes every route a directory: /blog/index.html
     instead of /blog.html. Plays nicest with file-based static hosts and
     gives us /blog/ as a valid URL. */
  trailingSlash: true,

  /* Surface real type errors instead of papering over them — the build
     should fail loudly if anything in the data layer drifts. */
  typescript: { ignoreBuildErrors: false },
  eslint:     { ignoreDuringBuilds: true },

  /* Restrict page detection to TS-only so the legacy /src/pages/*.jsx
     files left over from the pre-Next browser-runtime version don't get
     picked up by the Pages Router auto-detection. */
  pageExtensions: ['tsx', 'ts'],
};

export default nextConfig;
