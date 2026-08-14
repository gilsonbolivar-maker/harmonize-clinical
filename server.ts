import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { AI_ROUTES, isAiRoute } from "./lib/ai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Health Check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "Harmonize Clinical API" });
  });

  // Rotas de IA. A lógica vive em lib/ai.ts para ser compartilhada com as
  // Netlify Functions, evitando que os dois ambientes divirjam.
  app.post("/api/ai/:action", async (req: Request, res: Response) => {
    const { action } = req.params;

    if (!isAiRoute(action)) {
      return res.status(404).json({ success: false, error: `Rota de IA desconhecida: ${action}` });
    }

    const result = await AI_ROUTES[action](req.body);
    res.status(result.status).json(result.body);
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // O service worker nunca pode ser servido de cache: é ele quem controla a
    // atualização de todo o resto. Um sw.js preso no cache trava o app numa
    // versão antiga indefinidamente.
    app.get('/sw.js', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
      res.sendFile(path.join(distPath, 'sw.js'));
    });

    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            // Bundles do Vite têm hash no nome — seguro cachear para sempre.
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (filePath.endsWith('index.html') || filePath.endsWith('.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );

    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Harmonize Clinical Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
