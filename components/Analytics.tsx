import Script from 'next/script';

/**
 * Google Analytics 4 — only renders when NEXT_PUBLIC_GA_MEASUREMENT_ID
 * is set at build time. Without the env var, this component returns
 * null so a freshly cloned repo stays free of third-party scripts.
 *
 * The measurement ID looks like `G-XXXXXXXXXX`.
 */
export function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
