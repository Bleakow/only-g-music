/**
 * Configuración de presentación de redes sociales (label + icono). Vive en la
 * feature (no en el dominio) porque referencia componentes de UI (iconos).
 */
import type { SocialPlatform } from "@only-g/shared-types/artist";
import {
  SpotifyIcon,
  InstagramIcon,
  YouTubeIcon,
  XIcon,
  FacebookIcon,
  TikTokIcon,
  ThreadsIcon,
} from "@/components/icons";

export const SOCIAL_META: Record<
  SocialPlatform,
  { label: string; Icon: typeof SpotifyIcon }
> = {
  instagram: { label: "Instagram", Icon: InstagramIcon },
  spotify: { label: "Spotify", Icon: SpotifyIcon },
  youtube: { label: "YouTube", Icon: YouTubeIcon },
  tiktok: { label: "TikTok", Icon: TikTokIcon },
  x: { label: "X", Icon: XIcon },
  facebook: { label: "Facebook", Icon: FacebookIcon },
  threads: { label: "Threads", Icon: ThreadsIcon },
};
