import { ImageResponse } from 'next/og';
import { CONTENT } from '@/lib/content';
import { renderRouteOg, ogSize, ogContentType } from '@/lib/og-template';

export const alt = `Writing — ${CONTENT.site.fullName}`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return new ImageResponse(
    renderRouteOg({
      eyebrow: 'Writing',
      title: CONTENT.blog.hero.heading,
      subtitle: CONTENT.blog.hero.lede,
    }),
    { ...size },
  );
}
