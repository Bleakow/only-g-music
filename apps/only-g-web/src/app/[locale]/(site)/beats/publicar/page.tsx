import { RequireRole } from "@/features/auth/components/RequireRole";
import { PublicarBeats } from "@/features/beats/components/PublicarBeats";

// Sin `title`/`message`: el guard cae en sus defaults genéricos
// (auth.noAccess / auth.noAccessDesc) — los de "guards" son admin-específicos
// y no aplican a este gate por rol `beatmaker`.
export default function PublicarBeatsPage() {
  return (
    <RequireRole roles={["beatmaker"]}>
      <PublicarBeats />
    </RequireRole>
  );
}
