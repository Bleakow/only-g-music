import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { ProducerConsole } from "@/features/console/components/ProducerConsole";

export default async function ConsolaPage() {
  const t = await getTranslations("guards");
  return (
    <RequireRole
      roles={["productor"]}
      title={t("consoleTitle")}
      message={t("consoleMessage")}
    >
      <ProducerConsole />
    </RequireRole>
  );
}
