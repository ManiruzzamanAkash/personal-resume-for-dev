import { ImageResponse } from 'next/og';
import { CONTENT } from '@/lib/content';
import { renderRouteOg, ogSize, ogContentType } from '@/lib/og-template';

export const alt = `Projects — ${CONTENT.site.fullName}`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return new ImageResponse(
    renderRouteOg({
      eyebrow: 'Projects',
      title: "Things I've shipped",
      subtitle: 'Product work, platforms & open source',
    }),
    { ...size },
  );
}
