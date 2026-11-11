import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { planImageHandler } from "./lib/planImage";
import { logoHandler } from "./lib/logo";
import { dailyReportPdfHandler, startDailyReportScheduler } from "./lib/dailyReport";
import { weeklyReportHandler } from "./lib/weeklyReport";
import { whatsappVerifyHandler, whatsappWebhookHandler } from "./lib/whatsapp";
import { logSmtpStatusOnBoot } from "./lib/mailer";
import { photoArchiveHandler, photoHandler } from "./lib/photoHttp";
import { siteEventHandler } from "./lib/siteEvents";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
// Kat planı görseli tRPC dışında, tarayıcı önbelleğine uygun ayrı uçtan sunulur
app.get("/api/plan-image/:id", planImageHandler);
app.get("/api/logo/:companyId", logoHandler);
app.get("/api/rapor/gunluk.pdf", dailyReportPdfHandler);
app.get("/api/rapor/haftalik", weeklyReportHandler);
// Saha fotoğraf arşivi: görsel ve standart klasörlü ZIP
app.get("/api/foto/:id", photoHandler);
app.get("/api/foto-arsiv/:projectId", photoArchiveHandler);
// WhatsApp fotoğraf hattı (Meta Cloud API webhook; imza doğrulamalı)
app.get("/api/hooks/whatsapp", whatsappVerifyHandler);
app.post("/api/hooks/whatsapp", whatsappWebhookHandler);
// Site ziyaret kaydı (çerezsiz; Kurucu Paneli · Trafik)
app.post("/api/e", siteEventHandler);
// Render sağlık kontrolü (Settings → Health Check Path: /api/health)
app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    // Beklenmeyen sunucu hataları kurucu panelindeki hata kaydına düşer (kullanıcı hataları — yetki, doğrulama — düşmez)
    onError: ({ error, path, ctx }) => {
      if (error.code !== "INTERNAL_SERVER_ERROR") return;
      void import("./lib/usage").then((u) =>
        u.logAppError({ source: "trpc", path: path ?? null, code: error.code, message: error.message, userId: ctx?.user?.id ?? null }),
      );
    },
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  const { runMigrations } = await import("./lib/migrate");
  serveStaticFiles(app);

  await runMigrations();

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
  // Günlük rapor e-postası (varsayılan 19:00 İstanbul; SMTP yoksa sessiz)
  startDailyReportScheduler();
  logSmtpStatusOnBoot();
}
