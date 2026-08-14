import type { Config, Context } from "@netlify/functions";
import { AI_ROUTES, isAiRoute } from "../../lib/ai";

/**
 * Rotas de IA no Netlify.
 *
 * O Netlify serve apenas arquivos estáticos e funções sob demanda — o Express
 * de `server.ts` não roda lá. Esta função reexpõe `/api/ai/*` usando a mesma
 * lógica de `lib/ai.ts`, então prompts e fallbacks são idênticos nos dois
 * ambientes.
 */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Respostas clínicas nunca podem ser servidas de cache.
      "Cache-Control": "no-store",
    },
  });
}

export default async function handler(request: Request, context: Context): Promise<Response> {
  if (request.method !== "POST") {
    return json({ success: false, error: "Método não permitido. Use POST." }, 405);
  }

  const action = context.params.action;

  if (!action || !isAiRoute(action)) {
    return json({ success: false, error: `Rota de IA desconhecida: ${action}` }, 404);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, error: "Corpo da requisição não é um JSON válido." }, 400);
  }

  const result = await AI_ROUTES[action](payload);
  return json(result.body, result.status);
}

export const config: Config = {
  path: "/api/ai/:action",
};
