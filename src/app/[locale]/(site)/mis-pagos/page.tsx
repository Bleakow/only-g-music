import { RequireRole } from "@/features/auth/components/RequireRole";
import { MisPagos } from "@/features/socios/components/MisPagos";

// Solo socios (beatmaker/productor) tienen payouts. El guard cae en sus defaults
// genéricos (auth.noAccess); las reglas de Firestore, además, solo dejan al
// acreedor leer SUS propios payouts.
export default function MisPagosPage() {
  return (
    <RequireRole roles={["beatmaker", "productor"]}>
      <MisPagos />
    </RequireRole>
  );
}
