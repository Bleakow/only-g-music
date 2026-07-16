import { Notebook } from "@/features/notebook/Notebook";

// El cuaderno es el protagonista desde el primer momento: sin login, sin
// fricción, escribir de inmediato (persistencia local). Login/sync llegan en M6.
export default function Page() {
  return <Notebook />;
}
