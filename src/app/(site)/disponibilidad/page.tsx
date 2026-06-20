"use client";

import { RequireRole } from "@/features/auth/components/RequireRole";
import { AvailabilityEditor } from "@/features/availability/components/AvailabilityEditor";

export default function DisponibilidadPage() {
  return (
    <RequireRole
      roles={["productor", "admin"]}
      title="Solo para productores"
      message="Esta sección es para que los productores definan su disponibilidad."
    >
      <AvailabilityEditor />
    </RequireRole>
  );
}
