import type { Config } from "@netlify/functions";

/** Health check, equivalente ao /api/health do servidor Express. */
export default async function handler(): Promise<Response> {
  return new Response(
    JSON.stringify({ status: "ok", service: "Harmonize Clinical API" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export const config: Config = {
  path: "/api/health",
};
