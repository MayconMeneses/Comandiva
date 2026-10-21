import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Bug de 2026-10-21: quem abria mmsystem.tech sem estar logado era levado ao /comercial por
// setLocation (navegação do roteador), que renderiza o site comercial ANTIGO empacotado no
// cliente do Master. Só com recarregar a página o servidor entregava o site futurista. A raiz
// precisa fazer navegação completa, para o servidor decidir qual site comercial responde.
const read = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

describe("raiz do domínio leva o visitante ao site comercial servido pelo servidor", () => {
  const panel = read("client/src/components/PanelLayout.tsx");

  it('usa window.location.replace("/comercial") na raiz, sem logar', () => {
    expect(panel).toContain('window.location.replace("/comercial")');
  });

  it("não usa mais o roteador interno (setLocation) para ir ao /comercial", () => {
    expect(panel).not.toMatch(/setLocation\([^)]*"\/comercial"/);
  });

  it("as outras rotas do Painel continuam indo para /login", () => {
    expect(panel).toContain('setLocation("/login")');
  });
});
