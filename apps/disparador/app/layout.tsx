import type { Metadata } from "next";
import "@hagap/core/styles/tokens.css";
import "@hagap/core/styles/ui.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Disparador HAGAP",
  description: "Motor de envio WhatsApp das igrejas (fila, anti-ban e instâncias)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
