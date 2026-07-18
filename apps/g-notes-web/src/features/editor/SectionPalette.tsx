"use client";

import { useState } from "react";
import { glassSurfaceSoft } from "@only-g/ui";
import { SECTIONS } from "@/features/editor/sections";

/**
 * Paleta de secciones flotante en la esquina inferior del editor.
 * - PC (md+): todas las secciones siempre visibles (chips de cristal).
 * - Móvil: un botón «§» que las despliega; al elegir una, se cierra.
 * Los chips reutilizan el liquid glass de @only-g/ui.
 */
export function SectionPalette({
  onInsert,
}: {
  onInsert: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const chip = `${glassSurfaceSoft} rounded-lg px-2.5 py-1 text-[0.7rem] text-silver-200 transition hover:text-amethyst-200`;

  return (
    <>
      {/* PC: siempre visibles, alineadas a la esquina inferior derecha */}
      <div className="pointer-events-none absolute right-4 bottom-4 z-10 hidden max-w-[70%] flex-wrap justify-end gap-1.5 md:flex">
        {SECTIONS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onInsert(name)}
            className={`pointer-events-auto ${chip}`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Móvil: FAB que despliega, elige y cierra */}
      <div className="absolute right-4 bottom-4 z-10 flex flex-col items-end gap-2 md:hidden">
        {open && (
          <div className="flex max-h-[55vh] flex-col items-end gap-1.5 overflow-y-auto">
            {SECTIONS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onInsert(name);
                  setOpen(false);
                }}
                className={chip}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Cerrar secciones" : "Insertar sección"}
          aria-expanded={open}
          className={`${glassSurfaceSoft} flex size-11 items-center justify-center rounded-full text-xl leading-none text-amethyst-200 transition ${
            open ? "rotate-45" : ""
          }`}
        >
          {open ? "＋" : "§"}
        </button>
      </div>
    </>
  );
}
