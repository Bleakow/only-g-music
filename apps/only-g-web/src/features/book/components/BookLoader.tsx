"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { isSectionOn } from "@only-g/shared-types/profile-sections";
import type { Book } from "@only-g/shared-types/book";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import { getBook } from "../lib/book-repo";
import { BookView } from "./BookView";

/**
 * Carga el book y su perfil. Patrón de la casa: la data de Firestore se lee en
 * CLIENTE (la ruta es `force-dynamic`, no hay nada que prerenderizar).
 *
 * Quién ve qué:
 *  · publicado          → cualquiera, sin cuenta. El enlace se le manda a clientes.
 *  · sin publicar       → solo su dueña, con el aviso de que nadie más lo ve.
 *  · sección apagada    → nadie, ni aunque el documento exista: apagar la sección
 *                         `book` en el gestor tiene que apagar también el enlace
 *                         directo, o no serviría de nada apagarla.
 */
export function BookLoader({ slug }: { slug: string }) {
  const { user } = useAuth();
  const t = useTranslations("book");
  const [datos, setDatos] = useState<{
    book: Book | null;
    profile: ArtistProfile | null;
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([getProfileBySlug(slug), getBook(slug)])
      .then(([profile, book]) => vivo && setDatos({ profile, book }))
      .catch(() => vivo && setDatos({ profile: null, book: null }));
    return () => {
      vivo = false;
    };
  }, [slug]);

  // Lienzo del color de la casa mientras llega: un "Cargando…" que dura 200 ms
  // se lee como un parpadeo de error, no como una espera.
  if (!datos) return <div className="bg-ink min-h-dvh" />;

  const { book, profile } = datos;
  const esDuena = !!user && !!profile?.uid && user.uid === profile.uid;
  const seccionEncendida =
    !!profile &&
    isSectionOn("book", profile.sectionPrefs, profile.disciplines);
  const visible =
    !!book && !!profile && seccionEncendida && (book.publicado || esDuena);

  if (!visible) {
    return (
      <main className="bg-ink flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-narrow text-3xl font-bold text-white uppercase sm:text-5xl">
          {t("notFoundTitle")}
        </h1>
        <p className="text-silver-300 mt-4 max-w-md text-sm sm:text-base">
          {t("notFoundBody")}
        </p>
        <Link
          href={profile ? `/artistas/${slug}` : "/artistas"}
          className="border-silver-300/40 text-silver-100 hover:border-silver-100 mt-8 rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
        >
          {t("backToProfile")}
        </Link>
      </main>
    );
  }

  return (
    <BookView
      book={book}
      slug={slug}
      nombre={profile.artisticName}
      accentDelPerfil={profile.accent}
      // El book guarda QUÉ redes enseña, nunca sus URLs: esas viven en el
      // perfil, que es donde la modelo ya las mantiene. Una copia aquí sería un
      // enlace que se pudre el día que cambie de cuenta.
      socials={profile.socials}
      esBorrador={!book.publicado}
    />
  );
}
