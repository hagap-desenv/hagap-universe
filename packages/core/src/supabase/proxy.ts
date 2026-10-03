// Proxy (ex-middleware no Next 16): renova a sessão Supabase e protege as rotas do app.
// Sem `server-only` aqui: o proxy roda fora do grafo de React Server Components.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "../env";

export type AuthProxyOptions = {
  /** Prefixos acessíveis sem sessão (login, reset de senha, callback, health). */
  publicPaths: readonly string[];
  loginPath?: string;
  /** Páginas de visitante: com sessão ativa, redireciona para a home. */
  guestOnlyPaths?: readonly string[];
};

function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser valida o JWT no Auth (não confia só no cookie)
  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
}

function redirectWithCookies(target: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export function createAuthProxy(options: AuthProxyOptions) {
  const loginPath = options.loginPath ?? "/login";
  const guestOnly = options.guestOnlyPaths ?? [loginPath];

  return async function proxy(request: NextRequest): Promise<NextResponse> {
    const { pathname, search } = request.nextUrl;
    const { response, user } = await updateSession(request);

    if (!user && !matches(pathname, options.publicPaths)) {
      const target = request.nextUrl.clone();
      target.pathname = loginPath;
      target.search = "";
      if (pathname !== "/") target.searchParams.set("next", `${pathname}${search}`);
      return redirectWithCookies(target, response);
    }

    if (user && matches(pathname, guestOnly)) {
      const target = request.nextUrl.clone();
      target.pathname = "/";
      target.search = "";
      return redirectWithCookies(target, response);
    }

    return response;
  };
}
