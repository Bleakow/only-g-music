import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { ArtistOnboarding } from "@/features/artists/components/onboarding/ArtistOnboarding";

export default function ArtistOnboardingPage() {
  return (
    <RequireAuth
      title="Perfil de artista"
      message="Inicia sesión para crear tu perfil de artista."
    >
      <ArtistOnboarding />
    </RequireAuth>
  );
}
