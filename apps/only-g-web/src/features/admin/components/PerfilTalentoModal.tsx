"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { TALENT_ROLES, type Role } from "@only-g/shared-types/user";
import {
  fraccionAPorcentaje,
  porcentajeAFraccion,
} from "@only-g/shared-types/comercial-config";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  ActivityIcon,
  AudioLinesIcon,
  CameraIcon,
  CheckIcon,
  DiscIcon,
  MegaphoneIcon,
  MicIcon,
  SpinnerIcon,
} from "@/components/icons";
import { adminInner, adminInput, adminLabel } from "./admin-ui";
import {
  adminGetPerfilTalento,
  adminSetPerfilTalento,
  type PerfilTalento,
} from "../lib/admin-talento-repo";

/** Un icono por arte — el mismo criterio que `DisciplineTags` en el perfil. */
const ARTE_ICON: Partial<Record<Role, typeof MicIcon>> = {
  artista: MicIcon,
  dj: DiscIcon,
  bailarin: ActivityIcon,
  presentador: MegaphoneIcon,
  modelo: CameraIcon,
  beatmaker: AudioLinesIcon,
};

/**
 * ARTES Y COMISIONES de un perfil, desde el panel del admin.
 *
 * Es la ventana que faltaba: hasta ahora el editor mandaba al admin a "Perfiles
 * y convenios", que es la ventana del USUARIO LOGUEADO — así que el admin se
 * asignaba a sí mismo las artes que quería dar a otro. Aquí todo lo que se toca
 * va al perfil que se está editando, nunca a quien lo edita.
 *
 * La ventana se comporta distinto según de dónde cuelgue el perfil, y esa es la
 * distinción que estructura toda la pantalla:
 *   · MOCK (sin cuenta) — solo artes. Es relleno de vitrina: no hay a quién
 *     pagarle, así que no hay comisiones que pactar, y se enciende y se apaga a
 *     gusto sin pasar por ningún convenio.
 *   · VINCULADO — artes + comisiones. Tampoco pasa por el flujo de solicitud de
 *     convenio: si el admin está aquí es porque ya habló con esa persona. Lo que
 *     se guarda son SUS roles y SU comisión, en su cuenta.
 */
export function PerfilTalentoModal({
  slug,
  open,
  onClose,
  onSaved,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  /** Disciplinas ya guardadas: el editor las adopta sin recargar el perfil. */
  onSaved: (disciplines: Role[]) => void;
}) {
  const t = useTranslations();
  const [datos, setDatos] = useState<PerfilTalento | null>(null);
  const [artes, setArtes] = useState<Role[]>([]);
  const [beat, setBeat] = useState("");
  const [produccion, setProduccion] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada apertura relee: el admin pudo cambiar los roles en "Usuarios y roles"
  // entre una y otra, y editar sobre una foto vieja los revertiría sin avisar.
  useEffect(() => {
    if (!open || !slug) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    adminGetPerfilTalento(slug)
      .then((d) => {
        if (!vivo) return;
        setDatos(d);
        setArtes(d.artes);
        setBeat(fraccionAPorcentaje(d.comisiones.beat ?? undefined));
        setProduccion(
          fraccionAPorcentaje(d.comisiones.produccion ?? undefined),
        );
        setCargando(false);
      })
      .catch((e) => {
        if (!vivo) return;
        console.error("[perfil-talento] carga:", e);
        setError(t("perfilTalento.errorCarga"));
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [open, slug, t]);

  function alternar(arte: Role) {
    setArtes((prev) =>
      prev.includes(arte) ? prev.filter((r) => r !== arte) : [...prev, arte],
    );
  }

  /**
   * Qué comisiones procede pactar con ESTA persona. No todas las artes cobran
   * porcentaje: un modelo, un bailarín o un presentador no venden beats ni
   * reparten producción, así que enseñarles un campo de comisión solo invita a
   * rellenar un número que no lee nadie.
   *
   * `beatmaker` se mira sobre lo MARCADO AHORA (si acabas de darle la etiqueta,
   * el campo aparece sin guardar antes); `productor` sobre el rol real, que no se
   * concede desde aquí — es función comercial y va atada a una sede.
   */
  const muestraBeat = !!datos?.vinculado && artes.includes("beatmaker");
  const muestraProduccion = !!datos?.vinculado && datos.esProductor;

  async function guardar() {
    if (!datos || guardando) return;
    if (artes.length === 0) {
      setError(t("perfilTalento.errorSinArtes"));
      return;
    }
    // El % se teclea como 0..100 y se guarda como fracción. `null` = sin pactar
    // (hereda la global); un texto que no es un porcentaje se avisa, no se
    // interpreta — "12%" mal leído como 0 sería regalarle la venta entera.
    //
    // Un campo que NO se enseña se manda TAL Y COMO ESTABA, no a `null`: guardar
    // las artes de un modelo no puede borrar de rebote la comisión de beats que
    // alguien pactó antes de quitarle la etiqueta.
    const fBeat = muestraBeat ? porcentajeAFraccion(beat) : undefined;
    const fProd = muestraProduccion ? porcentajeAFraccion(produccion) : undefined;
    if (fBeat === null || fProd === null) {
      setError(t("perfilTalento.errorPorcentaje"));
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const { disciplines } = await adminSetPerfilTalento({
        slug,
        artes,
        comisionBeat: muestraBeat
          ? (fBeat ?? null)
          : datos.comisiones.beat,
        comisionProduccion: muestraProduccion
          ? (fProd ?? null)
          : datos.comisiones.produccion,
      });
      onSaved(disciplines);
      onClose();
    } catch (e) {
      console.error("[perfil-talento] guardar:", e);
      setError(
        e instanceof Error && e.message
          ? e.message
          : t("perfilTalento.errorGuardar"),
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={() => !guardando && onClose()}
      title={t("perfilTalento.title")}
      className="max-w-xl"
    >
      {cargando ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : (
        <>
          {/* De dónde cuelga este perfil. Va lo primero porque decide qué se
              puede tocar aquí abajo. */}
          <p className="text-silver-300 text-sm leading-relaxed">
            {datos?.vinculado
              ? t("perfilTalento.vinculadoHint", {
                  quien: datos.displayName || datos.email || datos.uid || "",
                })
              : t("perfilTalento.mockHint")}
          </p>

          {error && <Alert className="mt-4">{error}</Alert>}

          <div className="mt-5">
            <p className={adminLabel}>{t("perfilTalento.artesLabel")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TALENT_ROLES.map((arte) => {
                const Icon = ARTE_ICON[arte] ?? MicIcon;
                const on = artes.includes(arte);
                return (
                  <button
                    key={arte}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => alternar(arte)}
                    className={`flex min-h-12 items-center gap-3 rounded-xl border px-3.5 text-left transition ${
                      on
                        ? "border-amethyst-300/60 bg-amethyst-500/15"
                        : "border-white/12 bg-white/[0.03] hover:border-white/35"
                    }`}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-lg border ${
                        on
                          ? "border-amethyst-300/60 bg-amethyst-500/20 text-amethyst-200"
                          : "text-silver-400 border-white/12 bg-white/[0.04]"
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                      {t(`roles.${arte}`)}
                    </span>
                    {on && (
                      <CheckIcon
                        className="text-amethyst-200 size-4 shrink-0"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comisiones: SOLO con cuenta detrás Y solo las que esta persona
              puede llegar a cobrar. En un mock no hay a quién pagarle; en un
              modelo o un bailarín no hay venta de beats ni reparto de producción
              que repartir. Un campo que no lee nadie es peor que no tenerlo. */}
          {datos?.vinculado && (
            <div className={`mt-6 rounded-xl p-4 ${adminInner}`}>
              <p className={adminLabel}>{t("perfilTalento.comisionesLabel")}</p>
              {muestraBeat || muestraProduccion ? (
                <>
                  <p className="text-silver-400 mb-4 text-xs leading-relaxed">
                    {t("perfilTalento.comisionesHint")}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {muestraBeat && (
                      <PorcentajeField
                        label={t("perfilTalento.comisionBeat")}
                        value={beat}
                        onChange={setBeat}
                        placeholder={fraccionAPorcentaje(datos.globales.beat)}
                        hint={t("perfilTalento.globalHint", {
                          valor: fraccionAPorcentaje(datos.globales.beat) || "—",
                        })}
                      />
                    )}
                    {muestraProduccion && (
                      <PorcentajeField
                        label={t("perfilTalento.comisionProduccion")}
                        value={produccion}
                        onChange={setProduccion}
                        placeholder={fraccionAPorcentaje(
                          datos.globales.produccion ?? undefined,
                        )}
                        hint={
                          datos.globales.produccion === null
                            ? t("perfilTalento.globalSinFijar")
                            : t("perfilTalento.globalHint", {
                                valor: fraccionAPorcentaje(
                                  datos.globales.produccion,
                                ),
                              })
                        }
                      />
                    )}
                  </div>
                </>
              ) : (
                // Decirlo en vez de dejar el hueco: si no, el admin busca un
                // campo que nunca va a estar y acaba pensando que falla algo.
                <p className="text-silver-400 text-xs leading-relaxed">
                  {t("perfilTalento.sinComisiones")}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <GlassButton onClick={onClose} disabled={guardando}>
              {t("common.cancel")}
            </GlassButton>
            <GlassButton
              onClick={guardar}
              disabled={guardando || artes.length === 0}
              className="!text-amethyst-200"
            >
              {guardando ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <CheckIcon className="size-4" />
              )}
              {t("perfilTalento.guardar")}
            </GlassButton>
          </div>
        </>
      )}
    </GlassModal>
  );
}

/**
 * Input de PORCENTAJE: el admin teclea `20`, no `0.2`. El sufijo `%` va dentro
 * del campo para que no haya duda de en qué unidad se está escribiendo — la
 * confusión fracción/porcentaje es la forma más barata de equivocarse por 100×
 * en algo que es dinero.
 */
function PorcentajeField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint: string;
}) {
  return (
    <label className="block">
      <span className={adminLabel}>{label}</span>
      <span className="relative block">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder={placeholder}
          className={`${adminInput} pr-9 tabular-nums`}
        />
        <span
          className="text-silver-400 pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm"
          aria-hidden
        >
          %
        </span>
      </span>
      <span className="text-silver-500 mt-1 block text-[11px] leading-snug">
        {hint}
      </span>
    </label>
  );
}
