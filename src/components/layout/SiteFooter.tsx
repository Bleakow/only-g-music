import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { SpotifyIcon, InstagramIcon, YouTubeIcon } from "@/components/icons";

const NAV = [
  { href: "/artistas", key: "nav.artists" },
  { href: "/beats", key: "nav.beats" },
  { href: "/producciones", key: "nav.productions" },
] as const;

const SOCIALS = [
  { href: "#", label: "Spotify", Icon: SpotifyIcon },
  { href: "#", label: "Instagram", Icon: InstagramIcon },
  { href: "#", label: "YouTube", Icon: YouTubeIcon },
];

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 px-6 py-12 sm:px-12">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" aria-label={t("nav.home")}>
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
              className="text-sm tracking-[2px] text-white/60 uppercase transition-colors hover:text-white"
            >
              {t(item.key)}
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
        {t("footer.rights", { year: String(year) })}
      </p>
    </footer>
  );
}
