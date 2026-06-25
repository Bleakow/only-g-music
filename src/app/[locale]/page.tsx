import { Hero } from "@/features/home/components/Hero";
import { HomeSections } from "@/features/home/components/HomeSections";
import { ProducersShowcase } from "@/features/producers/components/ProducersShowcase";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default async function HomePage() {
  return (
    <>
      <Hero />
      {/* z-10 + fondo opaco (ink): las secciones cubren el hero fijo al scrollear.
          Mismo color que el editorial y el degradado → transición foto↔fondo limpia. */}
      <div className="relative z-10 bg-ink">
        <ProducersShowcase />
        <HomeSections />
        <SiteFooter />
      </div>
    </>
  );
}
