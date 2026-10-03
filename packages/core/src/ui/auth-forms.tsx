"use client";
// Formulários de autenticação (login, pedido de reset, nova senha). Acessíveis: labels explícitos,
// erros anunciados (role="alert"), estado de envio em aria-busy.
import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "../auth";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function Feedback({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <p className="hg-alert hg-alert--error" role="alert">
        <span aria-hidden="true">⚠ </span>
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p className="hg-alert hg-alert--info" role="status">
        {state.message}
      </p>
    );
  }
  return null;
}

export function LoginForm({ action, next, notice }: { action: Action; next?: string; notice?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="hg-form" aria-busy={pending}>
      {notice ? (
        <p className="hg-alert hg-alert--info" role="status">
          {notice}
        </p>
      ) : null}
      <Feedback state={state} />
      <input type="hidden" name="next" value={next ?? "/"} />
      <div className="hg-field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} />
      </div>
      <div className="hg-field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" className="hg-button" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="hg-form__aside">
        <Link href="/reset-senha">Esqueci minha senha</Link>
      </p>
    </form>
  );
}

export function ResetRequestForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="hg-form" aria-busy={pending}>
      <Feedback state={state} />
      <div className="hg-field">
        <label htmlFor="email">E-mail cadastrado</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <button type="submit" className="hg-button" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link de redefinição"}
      </button>
      <p className="hg-form__aside">
        <Link href="/login">Voltar para o login</Link>
      </p>
    </form>
  );
}

export function UpdatePasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="hg-form" aria-busy={pending}>
      <Feedback state={state} />
      <div className="hg-field">
        <label htmlFor="password">Nova senha</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-describedby="password-hint"
        />
        <small id="password-hint">Mínimo de 8 caracteres.</small>
      </div>
      <div className="hg-field">
        <label htmlFor="confirm">Confirmar nova senha</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <button type="submit" className="hg-button" disabled={pending}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}

export function AuthLayout({ appName, title, children }: { appName: string; title: string; children: React.ReactNode }) {
  return (
    <main id="conteudo" className="hg-auth">
      <div className="hg-auth__card">
        <p className="hg-auth__brand">{appName}</p>
        <h1 className="hg-auth__title">{title}</h1>
        {children}
      </div>
    </main>
  );
}
