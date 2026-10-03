// Fábricas dos adaptadores reais (usadas pelas EFs; os testes injetam as suas).
import { evolutionFromEnv } from "./evolution.ts";
import { FakeProvider } from "./fake.ts";
import type { ProviderFactories } from "./provider.ts";

export const defaultProviderFactories: ProviderFactories = {
  fake: () => new FakeProvider("open"),
  evolution: (env) => evolutionFromEnv(env),
};
