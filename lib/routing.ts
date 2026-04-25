import type { RouteId } from './content';

/**
 * Resolve a route id (+ optional param) to a real URL pathname. Mirrors
 * the routes defined under CONTENT.seo.routes; keep them in sync.
 *
 *   pathFor('home')                       -> '/'
 *   pathFor('blog')                       -> '/blog'
 *   pathFor('article', 'welcome-to-blog') -> '/article/welcome-to-blog'
 */
export const pathFor = (route: RouteId | string, param?: string): string => {
  if (!route || route === 'home') return '/';
  if (route === 'article' && param) return `/article/${param}`;
  return `/${route}`;
};
