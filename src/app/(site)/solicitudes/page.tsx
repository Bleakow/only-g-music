"use client";

import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SolicitudesList } from "@/features/solicitudes/components/SolicitudesList";

export default function SolicitudesPage() {
  return (
    <RequireAuth
      title="Tus solicitudes"
      message="Inicia sesión para ver tus cotizaciones y reservas."
    >
      <SolicitudesList />
    </RequireAuth>
  );
}
