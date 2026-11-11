import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  app.use("*", serveStatic({ root: "./dist/public" }));

  // Uygulama sayfaları (/, /danismanlik, /danismanlik/:id …) tek index.html ile açılır.
  // Bunu notFound içinden yapmak yanıtı 404 durum koduyla gönderiyordu: tarayıcı sayfayı gösterir
  // ama Google "Bulunamadı (404)" görüp dizine almaz. Bu yüzden açıkça 200 ile dönülür.
  // /api altı ve dosya uzantılı istekler (eksik görsel, js) gerçek 404 olarak kalır.
  let indexHtml: string | null = null;
  const readIndex = () => (indexHtml ??= fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8"));

  app.get("*", (c, next) => {
    const p = c.req.path;
    if (p.startsWith("/api/") || p === "/api" || /\.[a-z0-9]{1,8}$/i.test(p)) return next();
    return c.html(readIndex(), 200);
  });

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    return c.html(readIndex(), 404);
  });
}
