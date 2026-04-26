import { ImageResponse } from 'next/og';
import { CONTENT } from '@/lib/content';
import { renderRouteOg, ogSize, ogContentType } from '@/lib/og-template';

export const alt = `${CONTENT.site.fullName} — ${CONTENT.site.jobTitle}`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return new ImageResponse(
    renderRouteOg({
      eyebrow: 'Portfolio',
      title: CONTENT.site.fullName,
      subtitle: CONTENT.site.tagline,
    }),
    { ...size },
  );
}
