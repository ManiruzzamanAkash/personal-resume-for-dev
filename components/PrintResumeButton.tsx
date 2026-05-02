'use client';

import { Magnetic } from './Magnetic';
import { I } from './icons';

/**
 * "Download PDF" button for the resume page. Triggers the browser's print
 * dialog with `print-resume.css` applied — recruiters get a clean, paginated
 * PDF (Save as PDF in any modern browser) without us having to ship and
 * keep an actual .pdf file in sync with the live resume content.
 */
export const PrintResumeButton = () => (
  <Magnetic>
    <button
      type="button"
      className="btn btn-ghost"
      data-cursor="hover"
      onClick={() => window.print()}
      aria-label="Download resume as PDF"
    >
      Download PDF <span className="arrow"><I.download /></span>
    </button>
  </Magnetic>
);
