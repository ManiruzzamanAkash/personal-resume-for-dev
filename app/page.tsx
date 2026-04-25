import type { Metadata } from 'next';
import { buildMetadata, collectStructuredData } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { ContactCTA } from '@/components/ContactCTA';
import { HomeHero } from '@/components/HomeHero';
import { HomeProjects } from '@/components/HomeProjects';
import {
  HomeMarquee, HomeStats, HomeAbout, HomeSkills, HomeTestimonials, HomeContributions,
} from '@/components/HomeSections';

export const metadata: Metadata = buildMetadata({ route: 'home' });

export default function HomePage() {
  return (
    <>
      <JsonLd graph={collectStructuredData('home')} />
      <Nav />
      <main id="main">
        <HomeHero />
        <HomeMarquee />
        <HomeStats />
        <HomeAbout />
        <HomeProjects />
        <HomeSkills />
        <HomeTestimonials />
        <HomeContributions />
        <ContactCTA />
      </main>
      <Footer />
    </>
  );
}
