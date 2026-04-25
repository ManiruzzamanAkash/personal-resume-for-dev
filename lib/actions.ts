/**
 * lib/actions.ts — Server-safe link resolution.
 *
 * Maps a CONTENT-level `action` name (`mail`, `calendly`, `github`, etc.) to
 * an `<a>`-friendly { href, target, rel } shape. No event handlers — those
 * live in lib/calendly.ts (client-only) so this file can be imported by
 * server components without crossing the RSC boundary.
 */

import { CONTENT } from './content';

export interface AnchorProps {
  href: string;
  target?: string;
  rel?: string;
}

export const resolveAction = (action: string): AnchorProps => {
  const site = CONTENT.site;
  switch (action) {
    case 'calendly':      return { href: site.calendly,            target: '_blank', rel: 'noreferrer' };
    case 'mail':          return { href: `mailto:${site.email}` };
    case 'github':        return { href: site.socials.github,       target: '_blank', rel: 'noreferrer' };
    case 'linkedin':      return { href: site.socials.linkedin,     target: '_blank', rel: 'noreferrer' };
    case 'youtube':       return { href: site.socials.youtube,      target: '_blank', rel: 'noreferrer' };
    case 'stackoverflow': return { href: site.socials.stackoverflow,target: '_blank', rel: 'noreferrer' };
    default:              return { href: '#' };
  }
};
