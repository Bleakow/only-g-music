import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Aplica a todo menos: API, internos de Next y archivos con extensión (assets).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
