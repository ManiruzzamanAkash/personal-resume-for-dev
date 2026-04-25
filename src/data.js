/* ============================================================
   data.js — All static content lives here.
   Edit values in this file when updating the site.
   No JSX, no logic — just exported globals.
   ============================================================ */

const SITE = {
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
  copyright: '© 2026 Maniruzzaman Akash · Dhaka, Bangladesh',
  contributionsLastYear: 1847,
};

const PROJECTS = [
  { id: 'surecart',     name: 'SureCart',          year: '2022—',      tags: ['WordPress', 'React', 'TypeScript'],     desc: 'Modern eCommerce platform. Scaled 1K → 100K+ active installs.', color: '#8345dd', initial: 'S' },
  { id: 'dokan',        name: 'Dokan Multivendor', year: '2018—2020',  tags: ['WooCommerce', 'React'],                 desc: 'Multivendor marketplace serving 100K+ stores.',                color: '#10b981', initial: 'D' },
  { id: 'wperp',        name: 'WP ERP',            year: '2018—2020',  tags: ['PHP', 'Vue', 'React'],                  desc: 'Enterprise resource planning for WordPress.',                  color: '#f59e0b', initial: 'E' },
  { id: 'cartpulse',    name: 'CartPulse',         year: '2023',       tags: ['WooCommerce', 'Gutenberg'],             desc: 'Abandoned cart recovery for WooCommerce.',                     color: '#ef4444', initial: 'C' },
  { id: 'laradashboard', name: 'Lara Dashboard',   year: '2024—',      tags: ['Laravel', 'Livewire', 'Tailwind'],      desc: 'TALL-stack CMS. Founded by me.',                                color: '#fb923c', initial: 'L' },
  { id: 'wpreactkit',   name: 'WP React Kit',      year: '2021—',      tags: ['WordPress', 'React', 'TypeScript'],     desc: 'Open source WordPress + React plugin starter.',                color: '#2563eb', initial: 'W' },
  { id: 'paysera',      name: 'Paysera Gateway',   year: '2020—2022',  tags: ['Symfony', 'WooCommerce'],               desc: 'Payment gateway used by 10K+ European merchants.',             color: '#06b6d4', initial: 'P' },
  { id: 'devsenv',      name: 'DevsEnv',           year: '2017—',      tags: ['WordPress', 'SEO', 'Content'],          desc: 'Tutorial blog for web developers. Founded by me.',             color: '#a855f7', initial: 'V' },
];

const EXPERIENCE = [
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
];

const SKILLS = [
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
];

const TESTIMONIALS = [
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
];

const STATS = [
  { num: 7,   suffix: '+',  label: 'Years Experience' },
  { num: 100, suffix: 'K+', label: 'Active Users' },
  { num: 13,  suffix: 'K+', label: 'YouTube Subs' },
  { num: 5,   suffix: 'K+', label: 'SO Reputation' },
];

const NAV_LINKS = [
  { id: 'home',    label: 'Work' },
  { id: 'resume',  label: 'Resume' },
  { id: 'blog',    label: 'Writing' },
  { id: 'contact', label: 'Contact' },
];

const OPEN_SOURCE = [
  {
    name: 'Lara Dashboard',
    desc: 'Founded — TALL-stack CMS for Laravel teams.',
    live: 'https://laradashboard.com',
    github: 'https://github.com/laradashboard/laradashboard',
  },
  {
    name: 'WP React Kit',
    desc: 'Open source WordPress + React plugin starter.',
    github: 'https://github.com/ManiruzzamanAkash/wp-react-kit',
  },
  {
    name: 'DevsEnv',
    desc: 'Founded — tutorial blog for web developers.',
    live: 'https://devsenv.com',
  },
];

const MARQUEE_WORDS = [
  'WordPress', 'React', 'TypeScript', 'Laravel', 'PHP',
  'Gutenberg', 'SOLID', 'Clean Code', 'WooCommerce', 'Symfony',
];

Object.assign(window, {
  SITE, PROJECTS, EXPERIENCE, SKILLS, TESTIMONIALS,
  STATS, NAV_LINKS, OPEN_SOURCE, MARQUEE_WORDS,
});
