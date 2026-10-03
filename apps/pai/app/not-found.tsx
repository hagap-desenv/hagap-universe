import Link from "next/link";

// 404 em pt-BR. Também é a resposta para áreas sem permissão (não revela que existem).
export default function NotFound() {
  return (
    <main id="conteudo" className="hg-auth">
      <div className="hg-auth__card">
        <h1 className="hg-auth__title">Página não encontrada</h1>
        <p>O endereço não existe ou você não tem acesso a esta área.</p>
        <p>
          <Link href="/">Voltar para o início</Link>
        </p>
      </div>
    </main>
  );
}
