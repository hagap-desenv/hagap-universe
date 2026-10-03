// Proxy (Next 16, ex-middleware): renova a sessão e protege o grupo (app) → sem sessão vai para /login.
import { createAuthProxy } from "@hagap/core/supabase/proxy";

export const proxy = createAuthProxy({
  publicPaths: ["/login", "/reset-senha", "/auth/callback", "/api/health"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
