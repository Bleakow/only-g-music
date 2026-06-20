import { RequireRole } from "@/features/auth/components/RequireRole";
import { ProducerConsole } from "@/features/console/components/ProducerConsole";

export default function ConsolaPage() {
  return (
    <RequireRole
      roles={["productor"]}
      title="Consola del productor"
      message="Esta sección es solo para productores."
    >
      <ProducerConsole />
    </RequireRole>
  );
}
