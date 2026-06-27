"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  COUNTRY_CODES,
  type CountryCode,
  type GeoLocation,
} from "@/domain/location";
import { loadCountryGeo, type CountryGeo } from "../lib/geo";

/**
 * Selector de ubicación en 3 niveles encadenados (país → departamento/estado →
 * ciudad), cada uno un combobox buscable. El dataset del país se carga PEREZOSO
 * al elegirlo. Estado y ciudad permiten escribir uno propio (allowCustom) por si
 * no está en la lista. Controlado: `value` (o null) + `onChange`.
 */
export function LocationPicker({
  value,
  onChange,
  className,
}: {
  value: GeoLocation | null;
  onChange: (loc: GeoLocation | null) => void;
  className?: string;
}) {
  const t = useTranslations();
  const [geo, setGeo] = useState<CountryGeo | null>(null);
  const [loading, setLoading] = useState(false);

  const country = value?.country ?? null;

  useEffect(() => {
    if (!country) {
      setGeo(null);
      return;
    }
    let active = true;
    setLoading(true);
    loadCountryGeo(country)
      .then((g) => {
        if (!active) return;
        setGeo(g);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[location] load:", e);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [country]);

  const countryOptions = COUNTRY_CODES.map((c) => ({
    value: c,
    label: t(`location.country.${c}`),
  }));
  const stateOptions = useMemo(
    () => (geo?.states ?? []).map((s) => ({ value: s.name, label: s.name })),
    [geo],
  );
  const cityOptions = useMemo(() => {
    const st = geo?.states.find((s) => s.name === value?.state);
    return (st?.cities ?? []).map((c) => ({ value: c, label: c }));
  }, [geo, value?.state]);

  function setCountry(c: string) {
    onChange({ country: c as CountryCode, state: "", city: "" });
  }
  function setState(s: string) {
    if (!country) return;
    onChange({ country, state: s, city: "" });
  }
  function setCity(c: string) {
    if (!country) return;
    onChange({ country, state: value?.state ?? "", city: c });
  }

  const search = t("location.search");
  const empty = t("location.empty");
  const useCustom = (x: string) => t("location.use", { value: x });

  return (
    <div className={className ?? "grid gap-2 sm:grid-cols-3"}>
      <SearchableSelect
        value={country ?? ""}
        onChange={setCountry}
        options={countryOptions}
        placeholder={t("location.countryPh")}
        searchPlaceholder={search}
        emptyText={empty}
        ariaLabel={t("location.countryPh")}
      />
      <SearchableSelect
        value={value?.state ?? ""}
        onChange={setState}
        options={stateOptions}
        disabled={!country}
        loading={loading}
        allowCustom
        customLabel={useCustom}
        placeholder={t("location.statePh")}
        searchPlaceholder={search}
        emptyText={empty}
        ariaLabel={t("location.statePh")}
      />
      <SearchableSelect
        value={value?.city ?? ""}
        onChange={setCity}
        options={cityOptions}
        disabled={!value?.state}
        allowCustom
        customLabel={useCustom}
        placeholder={t("location.cityPh")}
        searchPlaceholder={search}
        emptyText={empty}
        ariaLabel={t("location.cityPh")}
      />
    </div>
  );
}
