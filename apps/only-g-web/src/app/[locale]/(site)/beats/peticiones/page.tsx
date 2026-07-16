import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { PeticionesBeats } from "@/features/beats/components/PeticionesBeats";

// Sin `title`/`message`: el guard cae en sus defaults genéricos
// (auth.loginRequired / auth.loginRequiredDesc) — pedir/tomar una petición
// solo exige sesión, cualquier rol autenticado puede pedir un beat.
export default function PeticionesBeatsPage() {
  return (
    <RequireAuth>
      <PeticionesBeats />
    </RequireAuth>
  );
}
