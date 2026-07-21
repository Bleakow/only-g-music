import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { ProducerConsole } from "@/features/console/components/ProducerConsole";
import { CatalogBackground } from "@/features/services/components/CatalogBackground";
import {
  PANEL_PROD_BG_DESKTOP,
  PANEL_PROD_BG_MOBILE,
} from "@/features/services/data/services";

export default async function ConsolaPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["productor"]}
      title={t("consoleTitle")}
      message={t("consoleMessage")}
    >
      <CatalogBackground
        desktop={PANEL_PROD_BG_DESKTOP}
        mobile={PANEL_PROD_BG_MOBILE}
      >
        <ProducerConsole />
      </CatalogBackground>
    </RequireRole>
  );
}
