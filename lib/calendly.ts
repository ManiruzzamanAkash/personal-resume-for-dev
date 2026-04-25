'use client';

import { CONTENT } from './content';

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (opts: { url: string }) => void;
    };
  }
}

/** Open the Calendly popup. Falls back to a new-tab open if the script
   hasn't loaded yet (or is blocked). Use this as the onClick for any
   element that should trigger a Calendly booking flow. */
export const openCalendly = (e?: { preventDefault?: () => void }) => {
  if (e?.preventDefault) e.preventDefault();
  const url = CONTENT.site.calendly;
  if (!url) return;
  if (typeof window !== 'undefined' && window.Calendly?.initPopupWidget) {
    window.Calendly.initPopupWidget({ url });
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  }
};
