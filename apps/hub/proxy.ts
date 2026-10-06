// Proxy (Next 16, ex-middleware): renova a sessão e protege o grupo (app) → sem sessão vai para /login.
// /api/health fica fora do matcher: liveness não depende do Supabase.
import { createAuthProxy } from "@hagap/core/supabase/proxy";

export const proxy = createAuthProxy({
  publicPaths: ["/login", "/reset-senha", "/auth/callback", "/api/health"],
});

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm)$).*)"],
};
