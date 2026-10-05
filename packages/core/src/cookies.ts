// Login único (base): com AUTH_COOKIE_DOMAIN (ex.: ".hagap.online") os cookies de sessão e de igreja ativa
// valem para todos os apps em subdomínios do mesmo domínio. Sem a variável (ou com valor inválido), cada app
// mantém o cookie no próprio host — comportamento atual. Em *.vercel.app não há como compartilhar (Public Suffix).
// Puro (sem Next): testável com node:test.

// Nome de domínio com pelo menos um ponto (ex.: hagap.online), ponto inicial opcional; sem esquema/caminho/porta
const DOMAIN = /^\.?(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function cookieDomainFrom(value: string | undefined): string | undefined {
  const domain = value?.trim().toLowerCase();
  if (!domain || !DOMAIN.test(domain)) return undefined;
  return domain;
}

export function withSharedDomain<T extends object>(options: T, domain: string | undefined): T & { domain?: string } {
  return domain ? { ...options, domain } : { ...options };
}

// Domínio configurado no ambiente. Lido no servidor (AUTH_COOKIE_DOMAIN); no navegador só existe se o deploy
// expuser NEXT_PUBLIC_AUTH_COOKIE_DOMAIN com o mesmo valor (referências literais para o Next embutir).
export function sharedCookieDomain(): string | undefined {
  return cookieDomainFrom(process.env.AUTH_COOKIE_DOMAIN ?? process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN);
}
