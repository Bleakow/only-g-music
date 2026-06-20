import { RequireRole } from "@/features/auth/components/RequireRole";
import { ProfileEditor } from "@/features/artists/components/editor/ProfileEditor";

export default function ProfileEditorPage() {
  return (
    <RequireRole
      roles={["artista"]}
      title="Perfil de artista"
      message="Esta sección es para artistas con perfil activo. Crea tu alta primero."
    >
      <ProfileEditor />
    </RequireRole>
  );
}
