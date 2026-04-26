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
    short: 'Akash',
    title: 'Senior WordPress Plugin Developer & Software Architect',
    tagline: 'Freelance Senior Software Engineer & Ecommerce Specialist — 7+ years building WordPress plugins, WooCommerce / Shopify / SureCart stores, and SaaS developer tools used by 100K+ users worldwide.',
    location: 'Dhaka, Bangladesh',
    address: { city: 'Dhaka', region: 'Dhaka Division', country: 'BD', countryName: 'Bangladesh' },
    nationality: 'Bangladeshi',
    timezone: 'GMT+6',
    email: 'manirujjamanakash@gmail.com',
    status: 'Open to chat',
    calendly: 'https://calendly.com/manirujjamanakash/new-meeting',
    alumniOf: 'Patuakhali Science & Technology University',
    jobTitle: 'Senior WordPress Plugin Developer',
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
    url: 'https://maniruzzamanakash.com',
    locale: 'en_US',
    language: 'en',
    ogImage: '/assets/og-default.svg',
    ogImageAlt: '{fullName} — {title}',
    themeColor: '#8345dd',
    verification: { google: '', bing: '', yandex: '' },
    keywords: [
      // Hiring intent (freelance / contract)
      'Freelance Software Engineer',
      'Freelance Senior Software Engineer',
      'Freelance WordPress Developer',
      'Freelance WordPress Plugin Developer',
      'Freelance Ecommerce Developer',
      'Freelance Full Stack Developer',
      'Hire Freelance Developer',
      'Available for Freelance Work',
      'Remote Freelance Developer',
      'Contract Software Engineer',
      // Ecommerce specialist
      'Ecommerce Specialist',
      'Ecommerce Developer',
      'Ecommerce Consultant',
      'Custom Ecommerce Development',
      'Shopify Developer',
      'Shopify App Developer',
      'Shopify Expert',
      'WooCommerce Expert',
      'WooCommerce Developer',
      'WooCommerce Consultant',
      'Headless Commerce Developer',
      'SureCart Developer',
      'eCommerce Engineer',
      // Core engineering
      'Senior Software Engineer',
      'Senior WordPress Plugin Developer',
      'WordPress Developer',
      'WordPress Plugin Developer',
      'Software Architect',
      'Full Stack Developer',
      'PHP Developer',
      'Laravel Developer',
      'React Developer',
      'TypeScript Developer',
      'Gutenberg Developer',
      'Symfony Developer',
      'SaaS Engineer',
      'Open Source Developer',
      // Region + identity
      'Software Engineer Bangladesh',
      'WordPress Developer Bangladesh',
      'Freelance Developer Bangladesh',
      'Maniruzzaman Akash',
      'Md. Maniruzzaman Akash',
      'manirujjamanakash',
    ],
    routes: {
      home: {
        path: '/',
        title: '{fullName} — Freelance WordPress Plugin Developer & Ecommerce Engineer',
        description: "Hire {fullName} — a freelance Senior Software Engineer & ecommerce specialist with 7+ years building WordPress plugins, custom WooCommerce, Shopify, and SureCart stores, and SaaS developer tools used by 100K+ users worldwide. Available for freelance and contract work — based in {location}, working remote worldwide.",
        keywords: [
          'Freelance WordPress Plugin Developer',
          'Freelance Ecommerce Developer',
          'Hire Freelance Software Engineer',
          'WooCommerce Expert',
          'Shopify Developer',
          'SureCart Developer',
          'Senior WordPress Plugin Developer',
          'Ecommerce Specialist',
          'Software Architect',
          'WordPress Developer Portfolio',
        ],
        type: 'profile',
        priority: 1.0,
        changefreq: 'weekly',
      },
      resume: {
        path: '/resume',
        title: 'Resume · {fullName} — Freelance Senior Engineer & Ecommerce Specialist',
        description: 'Seven years shipping software across WordPress, WooCommerce, Shopify, Laravel, React, and Symfony. Detailed CV of {fullName} — freelance Senior WordPress Plugin Developer & ecommerce engineer, currently at Brainstorm Force (SureCart), ex-Paysera, ex-weDevs. Available for freelance, contract, and consulting engagements.',
        keywords: [
          'Senior Software Engineer Resume',
          'Freelance WordPress Developer CV',
          'Freelance Ecommerce Developer Resume',
          'Software Architect Resume',
          'Hire Freelance WordPress Plugin Developer',
          'Hire WooCommerce Developer',
          'Hire Shopify Developer',
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
        title: 'Hire {fullName} — Freelance WordPress, WooCommerce & Shopify Developer',
        description: "Get in touch with {fullName} — freelance Senior Software Engineer & ecommerce specialist. Available for freelance and contract work: WordPress plugin development, custom WooCommerce builds, Shopify apps & stores, SureCart engineering, and software architecture consulting. Based in {location}, working remote worldwide.",
        keywords: [
          'Hire Freelance WordPress Developer',
          'Hire Freelance Ecommerce Developer',
          'Hire WooCommerce Developer',
          'Hire Shopify Developer',
          'Freelance WordPress Plugin Consultant',
          'Software Architecture Consultant',
          'Hire Freelance Software Engineer Bangladesh',
          'Available for Freelance Work',
        ],
        type: 'website',
        priority: 0.8,
        changefreq: 'monthly',
      },
    },
    faq: [
      {
        q: 'Who is Maniruzzaman Akash?',
        a: 'Maniruzzaman Akash is a freelance Senior Software Engineer and ecommerce specialist from Dhaka, Bangladesh, with 7+ years of experience building scalable WordPress plugins, custom WooCommerce / Shopify / SureCart stores, and developer tools used by 100K+ users worldwide.',
      },
      {
        q: 'What does Maniruzzaman Akash do?',
        a: 'He works as a Senior WordPress Plugin Developer at Brainstorm Force engineering SureCart, contributes to open-source projects including Dokan Multivendor, WP ERP, and Lara Dashboard, and takes on freelance ecommerce and plugin development engagements.',
      },
      {
        q: 'What technologies does Maniruzzaman Akash use?',
        a: 'PHP, WordPress, Gutenberg, WooCommerce, Shopify, SureCart, Laravel, Symfony, React, TypeScript, Node.js, MySQL, Redis, Docker, and modern AI tooling including Claude, OpenAI, and MCP.',
      },
      {
        q: 'Is Maniruzzaman Akash available for freelance or contract work?',
        a: 'Yes — he is currently available for freelance and contract engagements, including WordPress plugin development, custom WooCommerce builds, Shopify apps and stores, ecommerce migrations, and software architecture consulting. He works remotely with clients worldwide. The fastest way to reach him is by email at manirujjamanakash@gmail.com or via Calendly.',
      },
      {
        q: 'Does Maniruzzaman Akash build Shopify or WooCommerce stores?',
        a: 'Yes. He builds custom WooCommerce stores, Shopify apps and themes, SureCart-powered storefronts, and headless commerce frontends. Past ecommerce work includes SureCart (100K+ active installs), Dokan Multivendor (100K+ stores), CartPulse, and the Paysera payment gateway used by 10K+ European merchants.',
      },
      {
        q: 'How much does it cost to hire Maniruzzaman Akash for a freelance project?',
        a: 'Pricing depends on scope, timeline, and complexity. Typical engagements range from short architecture reviews and code audits to multi-month plugin builds and ecommerce platform migrations. Reach out by email or book a 30-minute intro call via Calendly for a tailored quote.',
      },
    ],
  },

  navigation: [
    { id: 'home',    label: 'Work' },
    { id: 'resume',  label: 'Resume' },
    { id: 'blog',    label: 'Writing' },
    { id: 'contact', label: 'Contact' },
  ],

  marqueeWords: [
    'WordPress', 'React', 'TypeScript', 'Laravel', 'PHP',
    'Gutenberg', 'SOLID', 'Clean Code', 'WooCommerce', 'Symfony',
  ],

  stats: [
    { num: 7,   suffix: '+',  label: 'Years Experience' },
    { num: 100, suffix: 'K+', label: 'Active Users' },
    { num: 13,  suffix: 'K+', label: 'YouTube Subs' },
    { num: 5,   suffix: 'K+', label: 'StackOverflow Reputation' },
  ],

  projects: [
    { id: 'surecart',      name: 'SureCart',          year: '2022—',     tags: ['WordPress', 'React', 'TypeScript'], desc: 'Modern eCommerce platform. Scaled 1K → 100K+ active installs.', color: '#8345dd', initial: 'S' },
    { id: 'dokan',         name: 'Dokan Multivendor', year: '2018—2020', tags: ['WooCommerce', 'React'],             desc: 'Multivendor marketplace serving 100K+ stores.',                color: '#10b981', initial: 'D' },
    { id: 'wperp',         name: 'WP ERP',            year: '2018—2020', tags: ['PHP', 'Vue', 'React'],              desc: 'Enterprise resource planning for WordPress.',                  color: '#f59e0b', initial: 'E' },
    { id: 'cartpulse',     name: 'CartPulse',         year: '2023',      tags: ['WooCommerce', 'Gutenberg'],         desc: 'Abandoned cart recovery for WooCommerce.',                     color: '#ef4444', initial: 'C' },
    { id: 'laradashboard', name: 'Lara Dashboard',    year: '2024—',     tags: ['Laravel', 'Livewire', 'Tailwind'],  desc: 'TALL-stack CMS. Founded by me.',                                color: '#fb923c', initial: 'L' },
    { id: 'wpreactkit',    name: 'WP React Kit',      year: '2021—',     tags: ['WordPress', 'React', 'TypeScript'], desc: 'Open source WordPress + React plugin starter.',                color: '#2563eb', initial: 'W' },
    { id: 'paysera',       name: 'Paysera Gateway',   year: '2020—2022', tags: ['Symfony', 'WooCommerce'],           desc: 'Payment gateway used by 10K+ European merchants.',             color: '#06b6d4', initial: 'P' },
    { id: 'devsenv',       name: 'DevsEnv',           year: '2017—',     tags: ['WordPress', 'SEO', 'Content'],      desc: 'Tutorial blog for web developers. Founded by me.',             color: '#a855f7', initial: 'V' },
  ],

  experience: [
    {
      date: 'Dec 2022 — Present',
      role: 'Sr. WordPress Plugin Developer',
      company: 'Brainstorm Force Ltd.',
      desc: 'Engineering SureCart from 1K to 100K+ active installs. Payment gateways, eCommerce core, 100+ Gutenberg blocks, 90% test coverage.',
      tags: ['PHP', 'WordPress', 'React', 'TypeScript', 'Gutenberg'],
    },
    {
      date: 'Mar 2020 — Nov 2022',
      role: 'Software Engineer',
      company: 'Paysera Ltd. — Lithuania (Remote)',
      desc: 'Core microservices for Paysera payments. Plugins for WordPress, Shopify, Magento serving 10K+ merchants.',
      tags: ['PHP', 'Symfony', 'React', 'TypeScript'],
    },
    {
      date: 'Feb 2018 — Feb 2020',
      role: 'WordPress Plugin Developer',
      company: 'weDevs Ltd.',
      desc: 'Architected Dokan Multivendor, WP ERP, WP Project Manager. Reduced vulnerabilities 70% through hardening.',
      tags: ['PHP', 'WordPress', 'React', 'Redux'],
    },
    {
      date: 'May 2017 — Jan 2018',
      role: 'Full Stack Web Developer',
      company: 'Akij Group Ltd.',
      desc: 'Laravel APIs and React Native apps for 50K+ employees: iApp, iBOS, Akij City POS.',
      tags: ['Laravel', 'React', 'React Native'],
    },
  ],

  skills: [
    { num: '01', title: 'Languages',    skills: ['PHP', 'JavaScript', 'TypeScript', 'SQL'] },
    { num: '02', title: 'Frontend',     skills: ['React', 'Next.js', 'Vue', 'Tailwind', 'SCSS'] },
    { num: '03', title: 'Backend',      skills: ['Laravel', 'Symfony', 'Node.js', 'REST', 'GraphQL'] },
    { num: '04', title: 'WordPress',    skills: ['Plugins', 'Gutenberg', 'WooCommerce', 'Elementor', 'Bricks'] },
    { num: '05', title: 'Architecture', skills: ['SOLID', 'Clean Code', 'DDD', 'Microservices'] },
    { num: '06', title: 'AI / LLM',     skills: ['Prompt Engineering', 'Claude API', 'OpenAI API', 'RAG', 'AI agents', 'MCP'] },
    { num: '07', title: 'Testing',      skills: ['PHPUnit', 'Jest', 'Playwright', 'E2E'] },
    { num: '08', title: 'Database',     skills: ['MySQL', 'PostgreSQL', 'Redis'] },
    { num: '09', title: 'DevOps',       skills: ['Docker', 'Git', 'CI/CD', 'Vite'] },
    { num: '10', title: 'SEO',          skills: ['AIOSEO', 'RankMath', 'Schema', 'Core Web Vitals'] },
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
    { name: 'Lara Dashboard', desc: 'Founded — TALL-stack CMS for Laravel teams.', live: 'https://laradashboard.com', github: 'https://github.com/laradashboard/laradashboard' },
    { name: 'WP ERP', desc: 'Core contributor — open-source ERP for WordPress (690★).', live: 'https://wperp.com', github: 'https://github.com/wp-erp/wp-erp' },
    { name: 'Dokan Multivendor', desc: 'Core contributor — multivendor marketplace for WooCommerce (284★).', live: 'https://wedevs.com/dokan', github: 'https://github.com/getdokan/dokan' },
    { name: 'WP React Kit', desc: 'Open source WordPress + React plugin starter.', github: 'https://github.com/ManiruzzamanAkash/wp-react-kit' },
    { name: 'React-Redux Advanced CRUD', desc: 'Module-based React + Redux + JWT CRUD reference (15★).', github: 'https://github.com/ManiruzzamanAkash/React-Redux-Advance-CRUD' },
    { name: 'DevsEnv', desc: 'Founded — tutorial blog for web developers.', live: 'https://devsenv.com' },
  ],

  home: {
    hero: {
      title: 'Senior WordPress\n*plugin* developer &\nsoftware *architect.*',
      subtext: "I'm **{fullName}** — 7+ years building scalable WordPress plugins, ERP, eCommerce systems (**WooCommerce, Shopify, Magento, SureCart**), and developer tools used by **100K+** users worldwide. Currently engineering **SureCart** at Brainstorm Force — and love to discuss plugin builds, ecommerce projects, and architecture consulting.",
      ctaPrimary:   { label: 'View résumé', route: 'resume' },
      ctaSecondary: { label: 'Book a call', action: 'calendly' },
    },
    about: {
      eyebrow: 'About',
      heading: 'Building software that *scales* — one principle at a time.',
      avatar:  'A',
      paragraphs: [
        "I'm a passionate WordPress plugin developer and full-stack engineer based in Dhaka. For seven years I've been crafting scalable systems — from high-traffic eCommerce platforms to multi-tenant SaaS — always with a bias toward **clean architecture**, **SOLID principles**, and well-tested code.",
        "Currently I'm a Senior Plugin Developer at **Brainstorm Force**, where I work on **SureCart**. I've helped take it from one thousand active installations to over a hundred thousand — touching everything from payment gateways and subscriptions to Gutenberg blocks and performance.",
      ],
      now: {
        title: 'Currently',
        items: [
          { icon: 'rocket', heading: 'Shipping SureCart 4.0',          subtitle: 'Subscription redesign + new checkout architecture' },
          { icon: 'pen',    heading: 'Writing about plugin architecture', subtitle: 'A series on SOLID for WordPress engineers' },
          { icon: 'book',   heading: 'Reading *Domain-Driven Design*',  subtitle: 'Re-reading Eric Evans, third pass' },
        ],
      },
    },
    sections: {
      projects:      { eyebrow: 'Selected work', heading: "Things I've *shipped*.", count: '{n} projects' },
      skills:        { eyebrow: 'Stack',         heading: 'What I work *with*.' },
      testimonials:  { eyebrow: 'Words',         heading: "From the people I've *worked with*." },
      contributions: { eyebrow: 'Activity',      headingTemplate: '*{count}* contributions in the last year' },
    },
    contactCta: {
      eyebrow: "Let's talk",
      heading: "Got a *New* idea?\nLet's build it.",
      chips: [
        { icon: 'mail',   label: '{email}',         action: 'mail' },
        { icon: 'cal',    label: 'Book a 30-min call', action: 'calendly' },
        { icon: 'github', label: 'GitHub',          action: 'github' },
      ],
    },
  },

  resume: {
    hero: {
      eyebrow: 'Resume',
      heading: 'Seven years of *shipping* software.',
      lede: "Across WordPress, Laravel, and React — a long-form view of what I've built, what I've learned, and what I want to do next.",
      cta: { label: 'Get in touch', route: 'contact' },
    },
    aside: [
      { title: 'Location',  items: ['{location}', '{timezone}'] },
      { title: 'Email',     items: ['{email}'] },
      { title: 'Languages', items: ['English (Fluent)', 'Bengali (Native)'] },
      { title: 'Education', items: ['Patuakhali Science & Technology University', 'BSc, Computer Science'] },
    ],
    sections: {
      experience: { eyebrow: '01 — Experience', heading: "Where I've *worked*.",     lead: 'A timeline of teams, products, and the hard problems I helped solve.' },
      stack:      { eyebrow: '02 — Stack',      heading: 'What I work *with*.',       lead: 'A working list — sharper at the top, broader at the bottom.' },
      openSource: { eyebrow: '03 — Open Source', heading: "Open source I've *contributed* to.", lead: "Projects I've founded, maintained, or shipped meaningful work into — used by developers around the web." },
    },
  },

  blog: {
    hero: {
      eyebrow: 'Writing',
      heading: 'Notes on *building* for the long haul.',
      lede:    "Essays, deep-dives, and the occasional rant — across WordPress, Laravel, React, AI, software architecture, and whatever I'm learning lately.",
    },
    loading: 'LOADING…',
    feedEnd: 'END OF FEED',
    empty:   'No articles yet. Add one in articles/ and list it in articles/index.json.',
    error:   "Couldn't load articles.",
  },

  article: {
    backLabel:    'All articles',
    replyLabel:   'Reply by email',
    notFoundHead: 'Article not found',
  },

  contact: {
    hero: {
      eyebrow: 'Contact',
      heading: "Let's *talk*.",
      lede:    'Whether you want to swap notes on architecture, pick my brain about a plugin, or just say hi — drop a line. I usually respond within a day.',
    },
    summary: "I'm currently **@ Brainstorm Force**, but I'm always happy to chat — about engineering problems, plugin architecture, AI, or whatever you're building.",
    links: [
      { icon: 'mail',     title: '{email}',                          subtitle: 'The fastest way to reach me',     action: 'mail' },
      { icon: 'cal',      title: 'Book a 30-minute intro',           subtitle: 'Calendly · usually within the week', action: 'calendly' },
      { icon: 'linkedin', title: 'linkedin.com/in/maniruzzamanakash', subtitle: 'Connect professionally',          action: 'linkedin' },
    ],
    form: {
      fields: {
        name:    { label: 'Name',          placeholder: 'Your name' },
        email:   { label: 'Email',         placeholder: 'you@company.com' },
        type:    { label: 'Project type',  options: ['WordPress plugin development', 'WooCommerce / Shopify ecommerce build', 'SureCart / headless commerce', 'Technical consulting', 'Architecture review', 'Other'] },
        message: { label: 'Tell me about it', placeholder: 'Goals, timeline, anything I should know…' },
      },
      submit:    'Send message',
      submitted: 'Sent — thanks!',
    },
  },

  footer: {
    copyright: '© 2026 Maniruzzaman Akash · Dhaka, Bangladesh',
    links: [
      { label: 'GitHub',    action: 'github' },
      { label: 'LinkedIn',  action: 'linkedin' },
      { label: 'YouTube',   action: 'youtube' },
      { label: 'SO',        action: 'stackoverflow' },
    ],
  },
};

export const SITE = CONTENT.site;
