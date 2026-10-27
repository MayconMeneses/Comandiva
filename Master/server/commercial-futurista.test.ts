import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { FUTURISTA_OG_IMAGE_URL, registerCommercialFuturista } from "./_core/commercialFuturista";
import { injectRootCanonical } from "./_core/commercialMeta";

// Site futurista "de mentira" numa pasta temporária: mesmo formato do build real
// (index.html com as tags que o servidor substitui + assets com hash).
const INDEX_HTML = `<!doctype html><html><head>
<title>Padrão</title>
<meta name="description" content="padrão" />
<link rel="canonical" href="https://mmsystem.tech/comercial" />
<meta property="og:title" content="padrão" />
<meta property="og:description" content="padrão" />
<meta property="og:url" content="https://mmsystem.tech/comercial" />
<meta property="og:image" content="x" />
<meta name="twitter:title" content="padrão" />
<meta name="twitter:description" content="padrão" />
<meta name="twitter:image" content="x" />
</head><body><div id="root"></div><script type="module" src="/comercial/assets/app-abc123.js"></script></body></html>`;

describe("site comercial futurista em /comercial (COMMERCIAL_SITE=futurista)", () => {
  let dir: string;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "futurista-"));
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "index.html"), INDEX_HTML);
    fs.writeFileSync(path.join(dir, "assets", "app-abc123.js"), "console.log('ok')");
    fs.writeFileSync(path.join(dir, "og-comandiva.png"), "png");

    const app = express();
    expect(registerCommercialFuturista(app, dir)).toBe(true);
    app.get("/", (_req, res) => res.send("painel"));
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("todas as URLs que já existem no site atual respondem 200 com o HTML do futurista", async () => {
    for (const p of [
      "/comercial",
      "/comercial/planos",
      "/comercial/termos",
      "/comercial/privacidade",
      "/comercial/cadastro/premium",
      "/comercial/cadastro/sucesso?ref=1&t=x",
      "/comercial/cadastro/cardapio?ref=1&t=x",
      "/comercial/cadastro/confirmando?ref=1",
    ]) {
      const res = await fetch(`${base}${p}`);
      expect(res.status, p).toBe(200);
      expect(await res.text(), p).toContain('<div id="root">');
    }
  });

  it("barra no fim redireciona (301) para a URL sem barra, mantendo a query", async () => {
    for (const [de, para] of [
      ["/comercial/", "/comercial"],
      ["/comercial/planos/", "/comercial/planos"],
      ["/comercial/cadastro/sucesso/?ref=1&t=x", "/comercial/cadastro/sucesso?ref=1&t=x"],
    ]) {
      const res = await fetch(`${base}${de}`, { redirect: "manual" });
      expect(res.status, de).toBe(301);
      expect(res.headers.get("location"), de).toBe(para);
    }
  });

  it("a raiz recebe canônica para /comercial e as demais rotas não são afetadas", () => {
    const html = '<head><link rel="canonical" href="https://mmsystem.tech/" /></head>';
    expect(injectRootCanonical(html, "/")).toContain('href="https://mmsystem.tech/comercial"');
    expect(injectRootCanonical(html, "/?utm=1")).toContain('href="https://mmsystem.tech/comercial"');
    expect(injectRootCanonical(html, "/login")).toBe(html);
  });

  it("caminho inexistente em /comercial responde 404 de verdade (com a página do site)", async () => {
    const res = await fetch(`${base}/comercial/nao-existe`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('<div id="root">');
  });

  it("injeta título/OG por rota com a imagem de compartilhamento nova", async () => {
    const html = await (await fetch(`${base}/comercial/termos`)).text();
    expect(html).toContain("<title>Termos de Uso | Comandiva</title>");
    expect(html).toContain(`<meta property="og:image" content="${FUTURISTA_OG_IMAGE_URL}" />`);
    expect(html).toContain('<link rel="canonical" href="https://mmsystem.tech/comercial/termos" />');
  });

  it("serve os arquivos do build com cache longo e o HTML sem cache", async () => {
    const asset = await fetch(`${base}/comercial/assets/app-abc123.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect((await fetch(`${base}/comercial/og-comandiva.png`)).status).toBe(200);
    expect((await fetch(`${base}/comercial/planos`)).headers.get("cache-control")).toBe("no-cache");
  });

  it("não interfere no resto do app (Painel Master)", async () => {
    expect(await (await fetch(`${base}/`)).text()).toBe("painel");
  });

  it("sem o build, não registra nada (o servidor segue com o site legado)", () => {
    const app = express();
    expect(registerCommercialFuturista(app, path.join(dir, "nao-existe"))).toBe(false);
  });
});
