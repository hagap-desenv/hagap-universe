import type { Metadata } from "next";
import { Nunito, Sora } from "next/font/google";
import "@hagap/core/styles/tokens.css";
import "@hagap/core/styles/ui.css";
import "./globals.css";

// Fontes baixadas no build e servidas pelo próprio app (nenhuma requisição ao Google no navegador)
const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--hub-font-display", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["700", "800"], variable: "--hub-font-brand", display: "swap" });

export const metadata: Metadata = {
  title: "Hangap",
  description: "Conectando tecnologia, pessoas e inteligência. Painel de apps das igrejas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
