// A implementar (TDD): domínio de cookie compartilhado (login único).
export function cookieDomainFrom(_value: string | undefined): string | undefined {
  throw new Error("not implemented");
}

export function withSharedDomain<T extends object>(_options: T, _domain: string | undefined): T & { domain?: string } {
  throw new Error("not implemented");
}
