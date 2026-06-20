"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SiteMenu } from "./SiteMenu";

export function SiteHeader() {
  const pathname = usePathname();
  // En la lista de artistas el logo de Inicio sobra (hay título propio + menú).
  const hideLogo = pathname === "/artistas";

  return (
    <>
      {!hideLogo && (
        <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center px-6 py-5 sm:px-12">
            <Link href="/" aria-label="Inicio" className="group inline-block">
              <Image
                src="/logo/logo-white.png"
                alt="Only G"
                width={384}
                height={256}
                className="h-12 w-auto transition duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_0_16px_rgba(196,165,255,0.55)] group-active:scale-95 sm:h-16"
              />
            </Link>
          </div>
        </header>
      )}

      <SiteMenu />
    </>
  );
}
