/**
 * Avatar circular unificado: foto → iniciales → glifo de persona.
 *
 * La ESTRUCTURA (círculo recortado) viene del diseño (OGM.pen); el acabado
 * PREMIUM lo pone aquí el código: degradado amatista en el respaldo, anillo de
 * cristal y un sheen sutil arriba. Es presentacional — el consumidor lo envuelve
 * en un botón/enlace si necesita interacción (p. ej. el trigger de `UserMenu`).
 */

/** Iniciales a partir del nombre (o el correo como respaldo). */
export function initials(name?: string | null, email?: string | null): string {
  const base = name?.trim() || email || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function PersonGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-silver-100"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

type AvatarProps = {
  /** Foto del usuario/artista. Si falta, cae a iniciales o al glifo de persona. */
  src?: string | null;
  name?: string | null;
  email?: string | null;
  /** Diámetro en px. Default 44 (área táctil mínima cómoda). */
  size?: number;
  /** Anillo sutil de cristal, para dar definición sobre fondos con foto. */
  ring?: boolean;
  className?: string;
};

export function Avatar({
  src,
  name,
  email,
  size = 44,
  ring = true,
  className = "",
}: AvatarProps) {
  const known = Boolean(name || email);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${
        src ? "bg-black/40" : "from-amethyst-500 to-amethyst-700 bg-gradient-to-br"
      } ${ring ? "ring-1 ring-white/20" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : known ? (
        <span
          className="text-silver-100 font-bold"
          style={{ fontSize: Math.round(size * 0.36) }}
        >
          {initials(name, email)}
        </span>
      ) : (
        <PersonGlyph size={Math.round(size * 0.48)} />
      )}
      {/* Sheen de cristal solo en el respaldo (las fotos se dejan limpias). */}
      {!src && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
      )}
    </span>
  );
}
