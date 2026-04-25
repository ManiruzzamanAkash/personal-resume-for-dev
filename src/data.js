/* ============================================================
   data.js — THE single source of truth for site content.

   Everything visible on the site lives in the CONTENT object below.
   To rebrand or repurpose this site for a different person:
     1. Replace CONTENT.site (name, email, socials, etc.)
     2. Replace CONTENT.experience, .projects, .testimonials, .openSource
     3. Edit the prose blocks under CONTENT.home / .resume / .blog / .contact

   Inline emphasis convention (parsed by <Rich /> in lib.jsx):
     *italic*   → <em>italic</em>     (used for accent-colored words)
     **bold**   → <b>bold</b>         (used for emphasis in body text)
     \n         → <br />               (line break in headings/sub-text)

   No JSX, no logic — just data. Don't put React imports here.
   ============================================================ */

const CONTENT = {
  /* ---------- Site identity ---------- */
  site: {
    name: 'Maniruzzaman Akash',
    fullName: 'Md. Maniruzzaman Akash',
    short: 'Akash',
    title: 'Senior WordPress Plugin Developer & Software Architect',
    location: 'Dhaka, Bangladesh',
    timezone: 'GMT+6',
    email: 'manirujjamanakash@gmail.com',
    status: 'Open to chat',
    calendly: 'https://calendly.com/manirujjamanakash/new-meeting',
    socials: {
      github: 'https://github.com/ManiruzzamanAkash',
      linkedin: 'https://linkedin.com/in/maniruzzamanakash',
      youtube: 'https://www.youtube.com/@Maniruzzaman',
      stackoverflow: 'https://stackoverflow.com/users/5543577/maniruzzaman-akash',
    },
    contributionsLastYear: 7765,
  },

  /* ---------- Top nav ---------- */
  navigation: [
    { id: 'home',    label: 'Work' },
    { id: 'resume',  label: 'Resume' },
    { id: 'blog',    label: 'Writing' },
    { id: 'contact', label: 'Contact' },
  ],

  /* ---------- Marquee strip (Home, between hero and stats) ---------- */
  marqueeWords: [
    'WordPress', 'React', 'TypeScript', 'Laravel', 'PHP',
    'Gutenberg', 'SOLID', 'Clean Code', 'WooCommerce', 'Symfony',
  ],

  /* ---------- Stats (Home, under marquee) ---------- */
  stats: [
    { num: 7,   suffix: '+',  label: 'Years Experience' },
    { num: 100, suffix: 'K+', label: 'Active Users' },
    { num: 13,  suffix: 'K+', label: 'YouTube Subs' },
    { num: 5,   suffix: 'K+', label: 'SO Reputation' },
  ],

  /* ---------- Projects (Home, "Things I've shipped") ---------- */
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

  /* ---------- Experience (Resume, "Where I've worked") ---------- */
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

  /* ---------- Skills (Home + Resume) ---------- */
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

  /* ---------- Testimonials (Home, "From the people I've worked with") ---------- */
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

  /* ---------- Open source (Resume, "Things I maintain") ---------- */
  openSource: [
    {
      name: 'Lara Dashboard',
      desc: 'Founded — TALL-stack CMS for Laravel teams.',
      live: 'https://laradashboard.com',
      github: 'https://github.com/laradashboard/laradashboard',
    },
    {
      name: 'WP ERP',
      desc: 'Core contributor — open-source ERP for WordPress (690★).',
      live: 'https://wperp.com',
      github: 'https://github.com/wp-erp/wp-erp',
    },
    {
      name: 'Dokan Multivendor',
      desc: 'Core contributor — multivendor marketplace for WooCommerce (284★).',
      live: 'https://wedevs.com/dokan',
      github: 'https://github.com/getdokan/dokan',
    },
    {
      name: 'WP React Kit',
      desc: 'Open source WordPress + React plugin starter.',
      github: 'https://github.com/ManiruzzamanAkash/wp-react-kit',
    },
    {
      name: 'React-Redux Advanced CRUD',
      desc: 'Module-based React + Redux + JWT CRUD reference (15★).',
      github: 'https://github.com/ManiruzzamanAkash/React-Redux-Advance-CRUD',
    },
    {
      name: 'DevsEnv',
      desc: 'Founded — tutorial blog for web developers.',
      live: 'https://devsenv.com',
    },
  ],

  /* ============================================================
     PAGE COPY — strings here are passed through <Rich />.
     Use *italic* for accent (em) and **bold** for emphasis.
     ============================================================ */

  /* ---------- Home page ---------- */
  home: {
    hero: {
      // Title is rendered word-by-word with stagger animation.
      // Use \n to break to a new line, *word* for accent emphasis.
      title: 'Senior WordPress\n*plugin* developer &\nsoftware *architect.*',
      subtext: "I'm **{fullName}** — 7+ years building scalable WordPress plugins, eCommerce systems, and developer tools used by **100K+** users worldwide. Currently engineering **SureCart** at Brainstorm Force.",
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

  /* ---------- Resume page ---------- */
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
      experience: {
        eyebrow: '01 — Experience',
        heading: "Where I've *worked*.",
        lead:    'A timeline of teams, products, and the hard problems I helped solve.',
      },
      stack: {
        eyebrow: '02 — Stack',
        heading: 'What I work *with*.',
        lead:    'A working list — sharper at the top, broader at the bottom.',
      },
      openSource: {
        eyebrow: '03 — Open Source',
        heading: "Open source I've *contributed* to.",
        lead:    "Projects I've founded, maintained, or shipped meaningful work into — used by developers around the web.",
      },
    },
  },

  /* ---------- Blog ---------- */
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

  /* ---------- Article ---------- */
  article: {
    backLabel:    'All articles',
    replyLabel:   'Reply by email',
    notFoundHead: 'Article not found',
  },

  /* ---------- Contact ---------- */
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
        type:    { label: 'Project type',  options: ['Plugin development', 'Technical consulting', 'Architecture review', 'Other'] },
        message: { label: 'Tell me about it', placeholder: 'Goals, timeline, anything I should know…' },
      },
      submit:    'Send message',
      submitted: 'Sent — thanks!',
    },
  },

  /* ---------- Footer ---------- */
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

/* ============================================================
   Convenience aliases (back-compat with code that still reads
   the flat names). New code should reference CONTENT directly.
   ============================================================ */
const SITE          = CONTENT.site;
const NAV_LINKS     = CONTENT.navigation;
const MARQUEE_WORDS = CONTENT.marqueeWords;
const STATS         = CONTENT.stats;
const PROJECTS      = CONTENT.projects;
const EXPERIENCE    = CONTENT.experience;
const SKILLS        = CONTENT.skills;
const TESTIMONIALS  = CONTENT.testimonials;
const OPEN_SOURCE   = CONTENT.openSource;

Object.assign(window, {
  CONTENT,
  SITE, PROJECTS, EXPERIENCE, SKILLS, TESTIMONIALS,
  STATS, NAV_LINKS, OPEN_SOURCE, MARQUEE_WORDS,
});
