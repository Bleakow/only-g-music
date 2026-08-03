"use client";

import { useTranslations } from "next-intl";
import type { Role } from "@only-g/shared-types/user";
import {
  DIRECTORY_ROLES,
  disciplinesOf,
} from "@only-g/shared-types/talent-directory";
import {
  MicIcon,
  DiscIcon,
  ActivityIcon,
  MegaphoneIcon,
  CameraIcon,
  AudioLinesIcon,
  SlidersIcon,
} from "@/components/icons";
import { ProfileChip, type ProfileChipSize } from "./ProfileChip";

/** Un icono por arte: la etiqueta se reconoce antes de leerla. */
const ROLE_ICON: Partial<Record<Role, typeof MicIcon>> = {
  artista: MicIcon,
  dj: DiscIcon,
  bailarin: ActivityIcon,
  presentador: MegaphoneIcon,
  modelo: CameraIcon,
  beatmaker: AudioLinesIcon,
  productor: SlidersIcon,
};

/**
 * Etiquetas de las ARTES que maneja el artista (§05): un mismo perfil puede ser
 * cantante y productor a la vez, y eso define de qué va.
 *
 * Solo se muestran las disciplinas del directorio, en su orden de presentación
 * (`DIRECTORY_ROLES`): roles de cuenta como `admin` o `cliente` no son artes y
 * no pintan nada en un perfil público.
 */
export function DisciplineTags({
  disciplines,
  accent,
  size = "md",
  className = "",
}: {
  disciplines?: Role[];
  accent?: string;
  size?: ProfileChipSize;
  className?: string;
}) {
  const t = useTranslations();
  const roles = disciplinesOf({ disciplines }).filter((r) =>
    DIRECTORY_ROLES.includes(r),
  );
  const ordered = DIRECTORY_ROLES.filter((r) => roles.includes(r));
  if (ordered.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {ordered.map((r) => {
        const Icon = ROLE_ICON[r];
        return (
          <ProfileChip
            key={r}
            accent={accent}
            size={size}
            icon={Icon ? <Icon className="size-4" /> : undefined}
          >
            {t(`roles.${r}`)}
          </ProfileChip>
        );
      })}
    </div>
  );
}
