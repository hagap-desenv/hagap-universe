import type { Metadata } from "next";
import "@hagap/core/styles/tokens.css";
import "@hagap/core/styles/ui.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hangap",
  description: "Conectando tecnologia, pessoas e inteligência. Painel de apps das igrejas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
