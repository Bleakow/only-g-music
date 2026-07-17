import { LoginGate } from "@/features/auth/LoginGate";
import { Notebook } from "@/features/notebook/Notebook";

// El cuaderno exige sesión (M6): la cuenta es la misma de Only G Music. No es
// fricción gratuita — sin sesión, los endpoints de IA responden 401, y eso es
// lo que impide que un desconocido queme la cuota de Gemini.
export default function Page() {
  return (
    <LoginGate>
      <Notebook />
    </LoginGate>
  );
}
