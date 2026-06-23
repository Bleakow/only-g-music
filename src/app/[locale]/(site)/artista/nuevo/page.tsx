import { getTranslations } from "next-intl/server";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { ArtistOnboarding } from "@/features/artists/components/onboarding/ArtistOnboarding";

export default async function ArtistOnboardingPage() {
  const t = await getTranslations("guards");
  return (
    <RequireAuth
      title={t("artistTitle")}
      message={t("artistNewMessage")}
    >
      <ArtistOnboarding />
    </RequireAuth>
  );
}
