import Link from "next/link";
import Image from "next/image";
import {
  SpotifyIcon,
  InstagramIcon,
  YouTubeIcon,
} from "@/components/icons";

const NAV = [
  { href: "/artistas", label: "Artistas" },
  { href: "/eventos", label: "Eventos" },
  { href: "/producciones", label: "Producciones" },
];

const SOCIALS = [
  { href: "#", label: "Spotify", Icon: SpotifyIcon },
  { href: "#", label: "Instagram", Icon: InstagramIcon },
  { href: "#", label: "YouTube", Icon: YouTubeIcon },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 px-6 py-12 sm:px-12">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" aria-label="Inicio">
          <Image
            src="/logo/logo.png"
            alt="Only G"
            width={256}
            height={256}
            className="h-28 w-auto"
          />
        </Link>

        <nav className="flex flex-wrap gap-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm uppercase tracking-[2px] text-white/60 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex gap-3">
          {SOCIALS.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              aria-label={label}
              target="_blank"
              rel="noreferrer"
              className="flex size-11 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white hover:text-white"
            >
              <Icon className="size-4" />
            </a>
          ))}
        </div>
      </div>

      <p className="mt-8 text-xs text-white/40">
        © {year} Only G Music. Todos los derechos reservados.
      </p>
    </footer>
  );
}
