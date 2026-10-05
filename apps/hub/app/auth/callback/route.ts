import type { NextRequest } from "next/server";
import { handleAuthCallback } from "@hagap/core/auth";

// Link do e-mail (recuperação de senha): troca código/token por sessão e segue para `next`
export function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
