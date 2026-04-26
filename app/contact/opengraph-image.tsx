import { ImageResponse } from 'next/og';
import { CONTENT } from '@/lib/content';
import { renderRouteOg, ogSize, ogContentType } from '@/lib/og-template';

export const alt = `Contact ${CONTENT.site.fullName}`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return new ImageResponse(
    renderRouteOg({
      eyebrow: 'Contact',
      title: CONTENT.contact.hero.heading,
      subtitle: CONTENT.contact.hero.lede,
    }),
    { ...size },
  );
}
