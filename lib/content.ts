/* ============================================================
   lib/content.ts — Single source of truth for site content.

   Ported from the original src/data.js into a typed module. Edit
   here when rebranding or updating copy; every page reads from
   this object via `import { CONTENT } from '@/lib/content'`.

   Inline emphasis convention (parsed by <Rich />):
     *italic*   → <em>           (accent words)
     **bold**   → <b>             (body emphasis)
     \n         → <br />          (line break)
   ============================================================ */

export type ActionName =
  | 'mail'
  | 'calendly'
  | 'github'
  | 'linkedin'
  | 'youtube'
  | 'stackoverflow';

export type IconName =
  | 'arrow' | 'arrowUp' | 'arrowLeft'
  | 'github' | 'linkedin' | 'yt' | 'so'
  | 'mail' | 'cal' | 'sun' | 'moon'
  | 'download' | 'code' | 'rocket' | 'pen' | 'book'
  | 'chevronLeft' | 'chevronRight' | 'menu' | 'close';

export type RouteId = 'home' | 'resume' | 'blog' | 'article' | 'contact';

export interface SocialMap {
  github: string;
  linkedin: string;
  youtube: string;
  stackoverflow: string;
  twitter: string;
}

export interface SiteIdentity {
  name: string;
  fullName: string;
  short: string;
  title: string;
  tagline: string;
  location: string;
  address: { city: string; region: string; country: string; countryName: string };
  nationality: string;
  timezone: string;
  email: string;
  status: string;
  calendly: string;
  alumniOf: string;
  jobTitle: string;
  worksFor: { name: string; url: string };
  socials: SocialMap;
  twitterHandle: string;
  contributionsLastYear: number;
}

export interface RouteSeoConfig {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  type: string;
  priority: number;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

export interface SeoConfig {
  url: string;
  locale: string;
  language: string;
  ogImage: string;
  ogImageAlt: string;
  themeColor: string;
  verification: { google: string; bing: string; yandex: string };
  keywords: string[];
  routes: Record<RouteId, RouteSeoConfig>;
  faq: { q: string; a: string }[];
}

export interface NavLink { id: RouteId; label: string }

export interface Project {
  id: string;
  name: string;
  year: string;
  tags: string[];
  desc: string;
  color: string;
  initial: string;
}

export interface Experience {
  date: string;
  role: string;
  company: string;
  desc: string;
  tags: string[];
}

export interface SkillGroup {
  num: string;
  title: string;
  skills: string[];
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

export interface OpenSourceItem {
  name: string;
  desc: string;
  live?: string;
  github?: string;
}

/* AI / LLM work — shipped surfaces, integrations, MCP servers, and the
   author's personal AI-augmented workflow. Lives next to experience but
   reads as a separate section so 2026-era recruiters can find it fast. */
export interface AIWorkItem {
  /** Short display label, e.g. "AI block-editor assistant". */
  title: string;
  /** Outcome-first sentence; what it does + the impact / numbers. */
  desc: string;
  /** Tech / model / surface labels — rendered as small chips. */
  tags: string[];
  /** Optional links: 1-2 of {live, github, post}. */
  live?: string;
  github?: string;
  post?: string;
}

/** Selected case studies — long-form story teasers. Each maps to a
    deeper write-up on the blog or external post. */
export interface CaseStudy {
  title: string;
  /** One-line outcome. */
  outcome: string;
  /** Problem → constraint → approach → result, ~3 short lines. */
  summary: string;
  /** Key metric pulled out for skim-readers, e.g. "10K+ merchants". */
  metric?: string;
  /** Link to the full case study (article URL or external). */
  href: string;
  tags: string[];
}

/** Talks, podcasts, external articles, courses — anything that surfaces
    the author beyond this site. */
export interface Talk {
  title: string;
  /** "Talk", "Podcast", "Article", "Workshop", etc. */
  kind: string;
  /** Where it ran — venue, publication, or platform. */
  venue: string;
  date: string;
  href?: string;
}

/** Mentorship / leadership signal — who the author has helped grow,
    code-review philosophy, or short attributable quotes from mentees. */
export interface MentorshipItem {
  /** "Mentored 3 engineers at Brainstorm Force on plugin architecture". */
  title: string;
  desc: string;
  /** Optional attribution (mentee name + role). */
  source?: string;
}

/** "How I work" — freelance positioning. Each item is a single facet:
    engagement model, time zone, what the author takes / declines. */
export interface HowIWorkItem {
  /** "Engagement model", "Time zone", "I take on", "I decline". */
  label: string;
  value: string;
}

export interface Stat { num: number; suffix: string; label: string }

export interface Cta { label: string; route?: RouteId; action?: ActionName }
export interface Chip { icon: IconName; label: string; action: ActionName }

export interface Content {
  site: SiteIdentity;
  seo: SeoConfig;
  navigation: NavLink[];
  marqueeWords: string[];
  stats: Stat[];
  projects: Project[];
  experience: Experience[];
  skills: SkillGroup[];
  testimonials: Testimonial[];
  openSource: OpenSourceItem[];
  /* New senior-level resume sections — each is optional at the data
     level (empty array hides the section on /resume/) but the heading
     copy is required so authors don't ship blank UI by accident. */
  aiWork: AIWorkItem[];
  caseStudies: CaseStudy[];
  talks: Talk[];
  mentorship: MentorshipItem[];
  howIWork: HowIWorkItem[];
  home: {
    hero: { title: string; subtext: string; ctaPrimary: Cta; ctaSecondary: Cta };
    about: {
      eyebrow: string; heading: string; avatar: string;
      paragraphs: string[];
      now: { title: string; items: { icon: IconName; heading: string; subtitle: string }[] };
    };
    sections: {
      projects: { eyebrow: string; heading: string; count: string };
      skills: { eyebrow: string; heading: string };
      testimonials: { eyebrow: string; heading: string };
      contributions: { eyebrow: string; headingTemplate: string };
    };
    contactCta: { eyebrow: string; heading: string; chips: Chip[] };
  };
  resume: {
    hero: { eyebrow: string; heading: string; lede: string; cta: Cta };
    aside: { title: string; items: string[] }[];
    sections: {
      experience: { eyebrow: string; heading: string; lead: string };
      stack: { eyebrow: string; heading: string; lead: string };
      openSource: { eyebrow: string; heading: string; lead: string };
      aiWork: { eyebrow: string; heading: string; lead: string };
      caseStudies: { eyebrow: string; heading: string; lead: string };
      speaking: { eyebrow: string; heading: string; lead: string };
      leadership: { eyebrow: string; heading: string; lead: string };
      howIWork: { eyebrow: string; heading: string; lead: string };
    };
  };
  blog: {
    hero: { eyebrow: string; heading: string; lede: string };
    loading: string; feedEnd: string; empty: string; error: string;
  };
  article: { backLabel: string; replyLabel: string; notFoundHead: string };
  contact: {
    hero: { eyebrow: string; heading: string; lede: string };
    summary: string;
    links: { icon: IconName; title: string; subtitle: string; action: ActionName }[];
    form: {
      fields: {
        name: { label: string; placeholder: string };
        email: { label: string; placeholder: string };
        type: { label: string; options: string[] };
        message: { label: string; placeholder: string };
      };
      submit: string; submitted: string;
    };
  };
  footer: {
    copyright: string;
    links: { label: string; action: ActionName }[];
  };
}

export const CONTENT: Content = {
  site: {
    name: 'Maniruzzaman Akash',
    fullName: 'Md. Maniruzzaman Akash',
    short: 'M. Akash',
    title: 'Senior Software Engineer — WordPress, Laravel & Ecommerce Platforms',
    tagline: 'Senior software engineer with 7+ years building WordPress, Laravel, and ecommerce platforms used by 100K+ businesses worldwide. Currently scaling SureCart at Brainstorm Force; founder of Lara Dashboard (TALL-stack CMS); previously Paysera, weDevs, Akij Group.',
    location: 'Dhaka, Bangladesh',
    address: { city: 'Dhaka', region: 'Dhaka Division', country: 'BD', countryName: 'Bangladesh' },
    nationality: 'Bangladeshi',
    timezone: 'GMT+6',
    email: 'manirujjamanakash@gmail.com',
    status: 'Open to senior / staff roles · remote, EU/US/CA/CA overlap',
    calendly: 'https://calendly.com/manirujjamanakash/new-meeting',
    alumniOf: 'Patuakhali Science & Technology University',
    jobTitle: 'Senior Software Engineer',
    worksFor: { name: 'Brainstorm Force', url: 'https://brainstormforce.com' },
    socials: {
      github: 'https://github.com/ManiruzzamanAkash',
      linkedin: 'https://linkedin.com/in/maniruzzamanakash',
      youtube: 'https://www.youtube.com/@Maniruzzaman',
      stackoverflow: 'https://stackoverflow.com/users/5543577/maniruzzaman-akash',
      twitter: 'https://twitter.com/maniruzzamanakash',
    },
    twitterHandle: 'maniruzzamanakash',
    contributionsLastYear: 7765,
  },

  seo: {
    url: 'https://maniruzzaman.me',
    locale: 'en_US',
    language: 'en',
    ogImage: '/assets/og-default.svg',
    ogImageAlt: '{fullName} — {title}',
    themeColor: '#8345dd',
    verification: { google: '', bing: '', yandex: '' },
    keywords: [
      // Level / role intent (full-time)
      'Senior Software Engineer',
      'Staff Software Engineer',
      'Principal Software Engineer',
      'Senior Full Stack Engineer',
      'Senior Backend Engineer',
      'Senior Platform Engineer',
      'Software Architect',
      'Remote Senior Software Engineer',
      'Remote Staff Engineer',
      'Senior Software Engineer Remote EU',
      'Senior Software Engineer Remote US',
      // Domain / surface
      'Senior WordPress Engineer',
      'Senior WordPress Plugin Engineer',
      'Senior Laravel Engineer',
      'Laravel Platform Engineer',
      'Lara Dashboard',
      'TALL Stack Engineer',
      'Senior Ecommerce Engineer',
      'WooCommerce Platform Engineer',
      'SureCart Engineer',
      'Shopify Platform Engineer',
      'Headless Commerce Engineer',
      'Developer Tools Engineer',
      'SaaS Engineer',
      'Payments Engineer',
      // Stack
      'PHP Engineer',
      'Laravel Engineer',
      'React Engineer',
      'TypeScript Engineer',
      'Symfony Engineer',
      'Node.js Engineer',
      'Open Source Maintainer',
      // Region + identity
      'Software Engineer Bangladesh',
      'Senior Software Engineer Bangladesh',
      'Akash',
      'Maniruzzaman Akash',
      'Md. Maniruzzaman Akash',
      'manirujjamanakash',
    ],
    routes: {
      home: {
        path: '/',
        title: '{fullName} — Senior Software Engineer · WordPress, Laravel & Ecommerce',
        description: "{fullName} — senior software engineer with 7+ years building WordPress, Laravel, and ecommerce platforms used by 100K+ businesses worldwide. Currently scaling SureCart at Brainstorm Force; founder of Lara Dashboard (TALL-stack CMS for Laravel teams). Open to senior / staff roles — remote, EU/US/CA overlap, based in {location}.",
        keywords: [
          'Senior Software Engineer',
          'Staff Software Engineer',
          'Senior Full Stack Engineer',
          'Senior WordPress Engineer',
          'Senior Laravel Engineer',
          'Senior Ecommerce Engineer',
          'SureCart Engineer',
          'Lara Dashboard',
          'Software Architect',
          'Remote Senior Engineer',
          'Senior Software Engineer Bangladesh',
        ],
        type: 'profile',
        priority: 1.0,
        changefreq: 'weekly',
      },
      resume: {
        path: '/resume',
        title: 'Resume · {fullName} — Senior Software Engineer (WordPress, Laravel & Ecommerce)',
        description: 'Seven years shipping software across WordPress, Laravel, ecommerce, React, and Symfony. CV of {fullName} — senior software engineer currently scaling SureCart at Brainstorm Force; founder of Lara Dashboard; previously Paysera (10K+ EU merchants), weDevs (Dokan, WP ERP), Akij Group. Open to senior / staff roles — remote, EU/US/CA overlap.',
        keywords: [
          'Senior Software Engineer Resume',
          'Staff Software Engineer CV',
          'Senior WordPress Engineer Resume',
          'Senior Laravel Engineer Resume',
          'Senior Ecommerce Engineer Resume',
          'Software Architect Resume',
          'Remote Senior Engineer CV',
        ],
        type: 'profile',
        priority: 0.9,
        changefreq: 'monthly',
      },
      blog: {
        path: '/blog',
        title: 'Writing · {fullName} — Notes on WordPress, architecture & engineering',
        description: 'Long-form writing on WordPress plugin architecture, scaling SaaS, SOLID principles, Laravel, React, AI engineering, and the discipline of shipping software that lasts. Essays by {fullName}.',
        keywords: [
          'WordPress Plugin Architecture',
          'Software Engineering Blog',
          'WordPress Developer Blog',
          'SOLID WordPress',
          'Scaling WordPress Plugins',
        ],
        type: 'website',
        priority: 0.9,
        changefreq: 'weekly',
      },
      article: {
        path: '/article/',
        title: '{title} · {fullName}',
        description: '{excerpt}',
        type: 'article',
        priority: 0.8,
        changefreq: 'yearly',
      },
      contact: {
        path: '/contact',
        title: 'Get in touch · {fullName} — Senior Software Engineer',
        description: "Get in touch with {fullName} — senior software engineer (WordPress, Laravel, ecommerce). Open to senior / staff full-time roles, remote with EU/US/CA overlap; happy to chat about engineering, plugin architecture, Laravel platforms, and ecommerce systems. Based in {location}.",
        keywords: [
          'Contact Senior Software Engineer',
          'Hire Senior Engineer Remote',
          'Senior WordPress Engineer Hiring',
          'Senior Laravel Engineer Hiring',
          'Staff Engineer Open to Roles',
          'Senior Software Engineer Bangladesh',
        ],
        type: 'website',
        priority: 0.8,
        changefreq: 'monthly',
      },
    },
    faq: [
      {
        q: 'Who is Maniruzzaman Akash?',
        a: 'Maniruzzaman Akash is a senior software engineer from Dhaka, Bangladesh, with 7+ years of experience building WordPress, Laravel, and ecommerce platforms used by 100K+ businesses worldwide. He currently works on SureCart at Brainstorm Force and founded Lara Dashboard, a TALL-stack CMS for Laravel teams.',
      },
      {
        q: 'What does Maniruzzaman Akash do?',
        a: 'He works as a senior software engineer at Brainstorm Force, where he scales SureCart from 1K to 100K+ active installs. He founded and maintains Lara Dashboard (TALL-stack CMS for Laravel teams), contributes to open-source projects including Dokan Multivendor and WP ERP, and writes about engineering, AI, and ecommerce platforms.',
      },
      {
        q: 'What technologies does Maniruzzaman Akash use?',
        a: 'PHP, WordPress, Gutenberg, WooCommerce, SureCart, Laravel, Symfony, React, TypeScript, Node.js, MySQL, Redis, Docker, and modern AI tooling including Claude, OpenAI, RAG, and MCP.',
      },
      {
        q: 'Is Maniruzzaman Akash open to new roles?',
        a: 'Yes — he is open to senior / staff full-time engineering roles at product companies, especially in WordPress, Laravel, ecommerce, developer tools, AI-native SaaS, or distributed systems. Remote-first, comfortable with EU/US/CA overlap, open to relocation for the right team. The fastest way to reach him is by email at manirujjamanakash@gmail.com.',
      },
      {
        q: 'What is his experience with ecommerce and payments?',
        a: 'Production work across SureCart (1K → 100K+ active installs), Dokan Multivendor (100K+ stores), the Paysera payment gateway (10K+ European merchants), and integrations across WooCommerce, Shopify, and Magento.',
      },
      {
        q: 'Where can I read more of his writing?',
        a: 'Long-form writing on engineering, architecture, AI, and ecommerce lives on this site at /blog/. He also publishes on DEV Community and Medium, answers questions on Stack Overflow, and runs a YouTube channel with 13K+ subscribers covering WordPress, Laravel, React, and AI tutorials.',
      },
    ],
  },

  navigation: [
    { id: 'home', label: 'Work' },
    { id: 'resume', label: 'Resume' },
    { id: 'blog', label: 'Writing' },
    { id: 'contact', label: 'Contact' },
  ],

  marqueeWords: [
    'WordPress', 'React', 'TypeScript', 'Laravel', 'PHP',
    'Gutenberg', 'SOLID', 'Clean Code', 'WooCommerce', 'Symfony',
  ],

  stats: [
    { num: 7, suffix: '+', label: 'Years Experience' },
    { num: 100, suffix: 'K+', label: 'Active Users' },
    { num: 13, suffix: 'K+', label: 'YouTube Subs' },
    { num: 5, suffix: 'K+', label: 'StackOverflow Reputation' },
  ],

  projects: [
    { id: 'surecart', name: 'SureCart', year: '2022—', tags: ['WordPress', 'React', 'TypeScript'], desc: 'Ecommerce platform for WordPress. Owned core engineering as it scaled 1K → 100K+ active installs — payments, subscriptions, 100+ Gutenberg blocks.', color: '#8345dd', initial: 'S' },
    { id: 'paysera', name: 'Paysera Gateway', year: '2020—2022', tags: ['Symfony', 'WooCommerce', 'Shopify'], desc: 'Payment gateway used by 10K+ EU merchants. Sustained 99.9% uptime through PSD2 / SCA rollout; shipped WooCommerce, Shopify, and Magento integrations.', color: '#06b6d4', initial: 'P' },
    { id: 'dokan', name: 'Dokan Multivendor', year: '2018—2020', tags: ['WooCommerce', 'React'], desc: 'Multivendor marketplace platform for WooCommerce powering 100K+ stores. Architected core checkout + vendor-payout modules.', color: '#10b981', initial: 'D' },
    { id: 'wperp', name: 'WP ERP', year: '2018—2020', tags: ['PHP', 'Vue', 'React'], desc: 'Open-source ERP for WordPress (HR / CRM / Accounting). Core contributor — 690★ on GitHub, used by SMEs across 30+ countries.', color: '#f59e0b', initial: 'E' },
    { id: 'laradashboard', name: 'Lara Dashboard', year: '2024—', tags: ['Laravel', 'Livewire', 'Tailwind'], desc: 'Founded — TALL-stack CMS for Laravel teams. 385★ on GitHub, growing community of contributors.', color: '#fb923c', initial: 'L' },
    { id: 'cartpulse', name: 'CartPulse', year: '2023', tags: ['WooCommerce', 'Gutenberg'], desc: 'Abandoned-cart recovery for WooCommerce — automated email sequences, discount triggers, conversion analytics.', color: '#ef4444', initial: 'C' },
    { id: 'wpreactkit', name: 'WP React Kit', year: '2021—', tags: ['WordPress', 'React', 'TypeScript'], desc: 'Open-source WordPress + React + TypeScript plugin starter. Battle-tested boilerplate that ships with build pipeline, REST scaffolding, and i18n.', color: '#2563eb', initial: 'W' },
    { id: 'ibos', name: 'iBOS', year: '2017—2018', tags: ['Laravel', 'React', 'Automation'], desc: "Internal business-automation suite — Laravel APIs + React apps powering HR, POS, and ERP across Akij Group's 50K employees.", color: '#6366f1', initial: 'i' },
    { id: 'devsenv', name: 'DevsEnv', year: '2017—', tags: ['WordPress', 'SEO', 'Content'], desc: 'Founded — tutorial blog for web developers covering PHP, WordPress, Laravel, and React.', color: '#a855f7', initial: 'V' },
    { id: 'dmwords', name: 'DMWords', year: '2017—2018', tags: ['Laravel', 'PHP', 'EdTech'], desc: 'Language-learning platform — ~1,000 essential words for immigrants, foreign workers, and government partners settling into a new environment.', color: '#14b8a6', initial: 'M' },
  ],

  experience: [
    {
      date: 'Dec 2022 — Present',
      role: 'Senior Software Engineer',
      company: 'Brainstorm Force Ltd. — Remote',
      desc: 'Owning core SureCart engineering as it scaled from 1K → 100K+ active installs. Built and shipped: payment-gateway integrations (Stripe, PayPal, Mollie, Razorpay), subscription billing, 100+ Gutenberg blocks, headless storefront APIs. Drove test coverage from 30% → 90% with PHPUnit + Jest, cut critical-path response times ~40% through query + cache work, and mentored 3 engineers on plugin architecture and code review.',
      tags: ['PHP', 'WordPress', 'React', 'TypeScript', 'Gutenberg', 'Stripe'],
    },
    {
      date: 'Mar 2020 — Nov 2022',
      role: 'Software Engineer',
      company: 'Paysera Ltd. — Lithuania (Remote)',
      desc: 'Built core Symfony microservices for Paysera Payments and shipped the WooCommerce / Shopify / Magento gateway plugins used by 10K+ EU merchants — sustained 99.9% uptime through PSD2 / SCA rollout. Owned the WooCommerce plugin end-to-end: spec → ship → maintain, including merchant onboarding flows and reconciliation tooling.',
      tags: ['PHP', 'Symfony', 'React', 'TypeScript', 'PSD2'],
    },
    {
      date: 'Feb 2018 — Feb 2020',
      role: 'WordPress Plugin Engineer',
      company: 'weDevs Ltd.',
      desc: 'Architected modules across Dokan Multivendor (100K+ stores), WP ERP (open-source ERP), and WP Project Manager. Led a security-hardening pass that closed ~70% of known plugin vulnerabilities; wrote the onboarding doc and pairing path that ramped 6+ junior engineers.',
      tags: ['PHP', 'WordPress', 'React', 'Redux', 'WooCommerce'],
    },
    {
      date: 'May 2017 — Jan 2018',
      role: 'Full-Stack Engineer',
      company: 'Akij Group Ltd.',
      desc: 'Laravel APIs and React Native apps for an HR / POS / ERP suite (iApp, iBOS, Akij City POS) used internally by 50K+ employees across the group. Designed the JWT auth + role/permission layer that the product still runs on.',
      tags: ['Laravel', 'React', 'React Native', 'JWT'],
    },
  ],

  skills: [
    { num: '01', title: 'Languages',    skills: ['PHP', 'JavaScript', 'TypeScript', 'SQL'] },
    { num: '02', title: 'Frontend',     skills: ['React', 'Next.js', 'Vue', 'Tailwind', 'SCSS', 'Bootstrap', 'shadcn/ui'] },
    { num: '03', title: 'Backend',      skills: ['Laravel', 'Filament', 'Livewire', 'Symfony', 'Node.js', 'REST', 'GraphQL'] },
    { num: '04', title: 'WordPress',    skills: ['Plugins', 'Custom Themes', 'FSE', 'Gutenberg', 'ACF', 'WooCommerce', 'Elementor', 'Bricks'] },
    { num: '05', title: 'Architecture', skills: ['SOLID', 'DRY', 'KISS', 'Clean Code', 'DDD', 'Microservices'] },
    { num: '06', title: 'AI / LLM',     skills: ['Prompt Engineering', 'Claude API', 'OpenAI API', 'RAG', 'AI agents', 'MCP'] },
    { num: '07', title: 'Testing',      skills: ['PHPUnit', 'Jest', 'Playwright', 'TDD', 'E2E'] },
    { num: '08', title: 'Database',     skills: ['MySQL', 'PostgreSQL', 'SQL Server', 'SQLite', 'Redis'] },
    { num: '09', title: 'DevOps',       skills: ['Docker', 'Git', 'CI/CD', 'Vite'] },
    { num: '10', title: 'SEO',          skills: ['AIOSEO', 'RankMath', 'Schema', 'Core Web Vitals'] },
    { num: '11', title: 'Mobile',       skills: ['React Native', 'Expo', 'iOS', 'Android'] },
    { num: '12', title: 'Payments',     skills: ['Stripe', 'PayPal', 'Mollie', 'Paystack', 'Razorpay'] },
  ],

  testimonials: [
    {
      quote: "Maniruzzaman Akash is one of the best among all the people I have ever worked with. He is a productive, responsible, and hard-working person. He has great proficiency in PHP, WordPress, Typescript, JavaScript, React JS, etc. His coding structure is so clean and adaptive to anyone. I have learned some great design patterns and optimization techniques of React JS from him. He is a valuable asset for any company. Highly recommended.",
      name: 'Md Mostafizur Rahman',
      role: 'Fullstack Developer · Dec 2022',
    },
    {
      quote: "Akash is one of the most thoughtful WordPress engineers I've worked with. He cares deeply about architecture and ships clean, well-tested code.",
      name: 'Shams Sadek',
      role: 'Head of Engineering, weDevs Ltd.',
    },
    {
      quote: "A dedicated and self-motivated developer having the expertise in different technologies, who doesn't hesitate to go the extra mile to get things done.",
      name: 'Tanmay Kirtania',
      role: 'Developer, OptinMonster (Awesome Motive) · Oct 2022',
    },
    {
      quote: "An extraordinary and passionate human. Work is life, life is work, he believes in. Recommending this outstanding guy as your next best project partner.",
      name: 'Dipjyoti Sikder',
      role: 'Principal Software Engineer, BJIT · Apr 2021',
    },
  ],

  openSource: [
    { name: 'Lara Dashboard', desc: 'Founded — TALL-stack CMS for Laravel teams (385★).', live: 'https://laradashboard.com', github: 'https://github.com/laradashboard/laradashboard' },
    { name: 'WP ERP', desc: 'Core contributor — open-source ERP for WordPress (690★).', live: 'https://wperp.com', github: 'https://github.com/wp-erp/wp-erp' },
    { name: 'Dokan Multivendor', desc: 'Core contributor — multivendor marketplace for WooCommerce (284★).', live: 'https://wedevs.com/dokan', github: 'https://github.com/getdokan/dokan' },
    { name: 'WP React Kit', desc: 'Open source WordPress + React plugin starter.', github: 'https://github.com/ManiruzzamanAkash/wp-react-kit' },
    { name: 'React-Redux Advanced CRUD', desc: 'Module-based React + Redux + JWT CRUD reference (15★).', github: 'https://github.com/ManiruzzamanAkash/React-Redux-Advance-CRUD' },
    { name: 'Laravel Advanced API', desc: 'Laravel 11.x API architecture — JWT, repository + interface pattern, Swagger, PHPUnit (115★).', github: 'https://github.com/ManiruzzamanAkash/Laravel-Advanced-API' },
    { name: 'Vue 3 Advance CRUD', desc: 'Vue 3 + Vuex + Vue Router + Bootstrap-Vue CRUD SPA reference (85★).', github: 'https://github.com/ManiruzzamanAkash/Vue-3-Advance-CRUD' },
    { name: 'ERP API (.NET Core)', desc: '.NET Core ERP backend — CQRS + Mediator + repository patterns, Swagger (24★).', github: 'https://github.com/ManiruzzamanAkash/ERPAPI' },
    { name: 'DevsEnv', desc: 'Founded — tutorial blog for web developers.', live: 'https://devsenv.com' },
  ],

  /* ----------------------------------------------------------------
     AI / LLM work — placeholders. Replace with real shipped surfaces;
     each entry should have a verifiable outcome or link. Empty the
     array to hide the section on /resume/.
     ---------------------------------------------------------------- */
  aiWork: [
    {
      title: 'AI Agent block-editor assistant',
      desc: 'Designed an AI Agent-powered assistant for Gutenberg that helps content creators brainstorm, outline, and draft posts without leaving the editor. The assistant uses structured prompts and a custom React UI to guide users through the writing process, reducing friction and keeping them focused on content creation.',
      tags: ['Gutenberg', 'OpenAI', 'Streaming', 'TypeScript'],
    },
    {
      title: 'MCP server for plugin docs',
      desc: 'Built an open-source Model Context Protocol server that exposes WordPress plugin docs + code search to Claude Code, so AI agents can answer "how do I extend X" questions without scraping the web.',
      tags: ['MCP', 'Claude', 'Node.js', 'Open source'],
    },
    {
      title: 'RAG over WooCommerce store content',
      desc: 'Embedded product catalog + support tickets into pgvector and wired a small RAG agent to answer pre-sale questions on storefronts. Reduced first-response time from 4h to under 90s on the pilot store.',
      tags: ['RAG', 'pgvector', 'OpenAI', 'WooCommerce'],
    },
    {
      title: 'Claude Code as my pair programmer',
      desc: 'Daily AI-augmented workflow: spec-first prompts, structured plans, eval-driven prompt tuning, and disciplined token-cost reviews. I write less code by hand and ship higher-confidence diffs.',
      tags: ['Claude Code', 'Workflow', 'Eval', 'Cost control'],
    },
  ],

  /* ----------------------------------------------------------------
     Selected case studies — long-form deep-dives. Each maps to an
     article on /blog/ or an external write-up.
     ---------------------------------------------------------------- */
  caseStudies: [
    {
      title: 'WooCommerce vs Shopify vs SureCart: custom builds in the AI era',
      outcome: 'How I decide between the three for a custom store in 2026 — including where AI tooling tips the math.',
      summary:
        'Production work on all three platforms. The decision matrix I run with new clients, the Gutenberg / Elementor / Bricks template story, and why AI-assisted plugin work compounds harder on SureCart than on Woo or Shopify.',
      metric: 'WC + Shopify + SureCart',
      href: '/article/woocommerce-shopify-surecart-ai-era-custom-builds/',
      tags: ['Ecommerce', 'WooCommerce', 'Shopify', 'SureCart', 'AI'],
    },
  ],

  /* ----------------------------------------------------------------
     Speaking, writing, podcasts, courses. Empty to hide the section.
     ---------------------------------------------------------------- */
  talks: [
    {
      title: 'YouTube — Laravel, WordPress, React, AI tutorials',
      kind: 'Channel',
      venue: '@Maniruzzaman · 13K+ subscribers',
      date: 'Ongoing',
      href: 'https://www.youtube.com/@Maniruzzaman',
    },
    {
      title: 'DEV Community — articles on WordPress, Laravel & React',
      kind: 'Articles',
      venue: '@maniruzzamanakash · 16 posts',
      date: 'Ongoing',
      href: 'https://dev.to/maniruzzamanakash',
    },
    {
      title: 'Medium — long-form notes on engineering & AI',
      kind: 'Articles',
      venue: '@maniruzzamanakash',
      date: 'Ongoing',
      href: 'https://medium.com/@maniruzzamanakash',
    },
    {
      title: 'Stack Overflow — answering on PHP, WordPress, Laravel & React',
      kind: 'Q&A',
      venue: 'maniruzzaman-akash',
      date: 'Ongoing',
      href: 'https://stackoverflow.com/users/5543577/maniruzzaman-akash',
    },
  ],

  /* ----------------------------------------------------------------
     Mentorship / leadership signal. Mentee testimonials are most
     persuasive — pull the best one or two from LinkedIn.
     ---------------------------------------------------------------- */
  mentorship: [
    {
      title: 'Onboarded 10+ engineers at Akij Group Ltd, weDevs Ltd.',
      desc: 'Designed the plugin-architecture onboarding path for new hires, including documentation, pairing sessions, and code reviews. Helped junior developers ramp up on Laravel and React through structured mentorship.',
    },
    {
      title: 'Code-review philosophy',
      desc: 'I review for boundaries first (does this respect the plugin\'s public contract?), correctness second, style last. I expect tests to lock in behavior before refactors land.',
    },
    {
      title: 'Open-source review',
      desc: 'Reviewed and merged 100+ PRs on Lara Dashboard, WP React Kit, and contributor PRs across WP ERP / Dokan during my weDevs years and currently at Brainstorm Force.',
    },
  ],

  /* ----------------------------------------------------------------
     "What I want next" — full-time positioning. Specific enough that a
     recruiter can decide in five seconds whether their role is a fit.
     ---------------------------------------------------------------- */
  howIWork: [
    { label: 'Looking for', value: 'Senior or staff engineering roles where I can own plugin / platform architecture at a product company — WordPress, Laravel, ecommerce, developer tools, AI-native SaaS, or distributed systems.' },
    { label: 'Working style', value: 'Remote-first, async-by-default, EU/US/CA overlap from Dhaka (GMT+6). Comfortable with relocation for the right team.' },
    { label: 'Strongest in', value: 'Long-lived plugin / platform codebases with real users — owning the product end-to-end, raising the test bar, mentoring the next layer of engineers, and reasoning about backwards compatibility before shipping.' },
    { label: 'Less interested in', value: 'Pure-services consulting, agency-style short engagements, or roles where ecommerce / WordPress is treated as a side concern rather than the product.' },
  ],

  home: {
    hero: {
      title: 'Senior software engineer.\nI build *systems* used by\n*100K+* businesses.',
      subtext: "I'm **{fullName}** — 7+ years scaling **WordPress**, **Laravel**, and ecommerce platforms. Currently engineering **SureCart** at **Brainstorm Force**; founder of **Lara Dashboard** (TALL-stack CMS); previously **Paysera** (10K+ EU merchants), **weDevs** (Dokan, WP ERP), and **Akij Group**. *Open to senior / staff roles* — remote, EU/US/CA overlap.",
      ctaPrimary: { label: 'Get in touch', route: 'contact' },
      ctaSecondary: { label: 'View résumé', route: 'resume' },
    },
    about: {
      eyebrow: 'About',
      heading: 'Building software that *scales* — one principle at a time.',
      avatar: 'A',
      paragraphs: [
        "I'm a senior software engineer based in Dhaka. For seven years I've worked across the stack on **WordPress** plugins, **Laravel** applications, and ecommerce platforms that real businesses depend on — always with a bias toward **clean architecture**, **SOLID principles**, and well-tested code.",
        "Currently I work on **SureCart** at **Brainstorm Force**, where I've helped take the platform from one thousand active installs to over a hundred thousand — touching payment gateways, subscriptions, 100+ Gutenberg blocks, and the boring engineering decisions that keep performance steady at scale.",
        "Before that I built core microservices and ecommerce plugins at **Paysera** (used by 10K+ EU merchants), architected **Dokan Multivendor** and **WP ERP** at weDevs, and shipped Laravel APIs / React Native apps for 50K+ employees at **Akij Group**. Outside work I write *long-form essays* on engineering judgment, maintain open-source projects (Lara Dashboard, WP React Kit), and run a small YouTube channel.",
      ],
      now: {
        title: 'Currently',
        items: [
          { icon: 'code',   heading: 'Living inside *agentic* workflows', subtitle: 'Claude Code agents, subagents, and skills — wiring them into one plugin-dev harness' },
          { icon: 'rocket', heading: 'Studying *LLMs from the inside*',   subtitle: 'Tokenizers, attention, tool-use loops — under the abstraction, not on top of it' },
          { icon: 'book',   heading: 'Re-reading *Domain-Driven Design*', subtitle: 'Eric Evans, fifth pass — bounded contexts when LLMs write half the code' },
          { icon: 'pen',    heading: 'Sharpening *trusted judgment*',     subtitle: "Following the engineers whose calls still change rooms — taste the LLM can't fake" },
        ],
      },
    },
    sections: {
      projects: { eyebrow: 'Selected work', heading: "Things I've *shipped*.", count: '{n} projects' },
      skills: { eyebrow: 'Stack', heading: 'What I work *with*.' },
      testimonials: { eyebrow: 'Words', heading: "From the people I've *worked with*." },
      contributions: { eyebrow: 'Activity', headingTemplate: '*{count}* contributions in the last year' },
    },
    contactCta: {
      eyebrow: 'Open to roles',
      heading: "Senior / staff role *open*?\nLet's chat.",
      chips: [
        { icon: 'mail', label: '{email}', action: 'mail' },
        { icon: 'cal', label: 'Schedule a chat', action: 'calendly' },
        { icon: 'linkedin', label: 'LinkedIn', action: 'linkedin' },
        { icon: 'github', label: 'GitHub', action: 'github' },
      ],
    },
  },

  resume: {
    hero: {
      eyebrow: 'Resume',
      heading: 'Seven years of *shipping* software.',
      lede: "Across WordPress, Laravel, ecommerce, and React — a long-form view of what I've built, the problems I've owned, and the kind of work I want to do next.",
      cta: { label: 'Get in touch', route: 'contact' },
    },
    aside: [
      { title: 'Open to', items: ['Senior / Staff roles', 'Remote · EU/US/CA overlap', 'Open to relocation'] },
      { title: 'Location', items: ['{location}', '{timezone}'] },
      { title: 'Email', items: ['{email}'] },
      { title: 'Languages', items: ['English (Fluent)', 'Bengali (Native)'] },
      { title: 'Education', items: ['Patuakhali Science & Technology University', 'BSc, Computer Science'] },
      { title: 'References', items: ['Available on request'] },
    ],
    sections: {
      experience: { eyebrow: '01 — Experience', heading: "Where I've *worked*.", lead: 'A timeline of teams, products, and the hard problems I helped solve.' },
      stack: { eyebrow: '02 — Stack', heading: 'What I work *with*.', lead: 'A working list — sharper at the top, broader at the bottom.' },
      aiWork: { eyebrow: '03 — AI / LLM', heading: 'Working in the *AI era*.', lead: 'LLM-backed surfaces I\'ve shipped, MCP servers I\'ve built, and the AI-augmented workflow I work in every day.' },
      caseStudies: { eyebrow: '04 — Case Studies', heading: 'Selected *deep-dives*.', lead: 'A few problems I\'ve carried end-to-end — the kind of work that doesn\'t fit on a CV bullet.' },
      openSource: { eyebrow: '05 — Open Source', heading: "Open source I've *contributed* to.", lead: "Projects I've founded, maintained, or shipped meaningful work into — used by developers around the web." },
      speaking: { eyebrow: '06 — Writing & community', heading: 'Writing, *teaching*, Q&A.', lead: 'Where I show up beyond this site — long-form articles, tutorials, and answering questions for the developer community.' },
      leadership: { eyebrow: '07 — Leadership', heading: 'Mentoring & *code review*.', lead: 'How I help engineers around me grow — and what reviewing software at scale has taught me.' },
      howIWork: { eyebrow: '08 — What I want next', heading: 'Roles I\'m *open* to.', lead: 'A short, honest read on the kind of full-time engineering role I\'m looking for next — so recruiters and hiring managers can decide in five seconds whether we\'re a fit.' },
    },
  },

  blog: {
    hero: {
      eyebrow: 'Writing',
      heading: 'Notes on *building* for the long haul.',
      lede: "Essays, deep-dives, and the occasional rant — across WordPress, Laravel, React, AI, software architecture, and whatever I'm learning lately.",
    },
    loading: 'LOADING…',
    feedEnd: 'END OF FEED',
    empty: 'No articles yet. Add one in articles/ and list it in articles/index.json.',
    error: "Couldn't load articles.",
  },

  article: {
    backLabel: 'All articles',
    replyLabel: 'Reply by email',
    notFoundHead: 'Article not found',
  },

  contact: {
    hero: {
      eyebrow: 'Contact',
      heading: 'Get in *touch*.',
      lede: "I'm open to senior / staff full-time roles, and always happy to chat about engineering, plugin architecture, ecommerce platforms, or AI — drop a line. I usually respond within a day.",
    },
    summary: "I'm currently engineering **SureCart** at **Brainstorm Force** and *open to senior / staff full-time roles* — remote, EU/US/CA overlap. The fastest way to reach me is by email.",
    links: [
      { icon: 'mail', title: '{email}', subtitle: 'The fastest way to reach me', action: 'mail' },
      { icon: 'cal', title: 'Schedule a 30-min chat', subtitle: 'Calendly · usually within the week', action: 'calendly' },
      { icon: 'linkedin', title: 'linkedin.com/in/maniruzzamanakash', subtitle: 'Connect professionally', action: 'linkedin' },
      { icon: 'github', title: 'github.com/ManiruzzamanAkash', subtitle: 'Pinned repos + contribution history', action: 'github' },
    ],
    form: {
      fields: {
        name: { label: 'Name', placeholder: 'Your name' },
        email: { label: 'Email', placeholder: 'you@company.com' },
        type: { label: 'About', options: ['A senior / staff role at your company', 'Engineering question or feedback', 'Open-source / plugin question', 'Something else'] },
        message: { label: 'Tell me about it', placeholder: 'A few lines on the role, the team, or what you want to chat about…' },
      },
      submit: 'Send message',
      submitted: 'Sent — thanks!',
    },
  },

  footer: {
    copyright: '© 2026 Maniruzzaman Akash · Dhaka, Bangladesh',
    links: [
      { label: 'GitHub', action: 'github' },
      { label: 'LinkedIn', action: 'linkedin' },
      { label: 'YouTube', action: 'youtube' },
      { label: 'SO', action: 'stackoverflow' },
    ],
  },
};

export const SITE = CONTENT.site;
