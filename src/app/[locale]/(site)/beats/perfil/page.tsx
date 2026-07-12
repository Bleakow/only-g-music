import { RequireRole } from "@/features/auth/components/RequireRole";
import { BeatmakerOnboarding } from "@/features/artists/components/onboarding/BeatmakerOnboarding";

// Sin `title`/`message`: el guard cae en sus defaults genéricos
// (auth.noAccess / auth.noAccessDesc) — coherente con /beats/publicar, que gatea
// por el mismo rol `beatmaker`.
export default function BeatmakerPerfilPage() {
  return (
    <RequireRole roles={["beatmaker"]}>
      <BeatmakerOnboarding />
    </RequireRole>
  );
}
