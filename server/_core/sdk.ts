import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const LAST_SIGNED_IN_REFRESH_MS = 5 * 60_000;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class SessionService {
  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId || "pubx-local",
        name: options.name || "",
      },
      options,
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;

    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;
      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        return null;
      }
      return { openId, appId, name };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = parseCookieHeader(req.headers.cookie || "");
    let sessionToken = cookies[COOKIE_NAME];

    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }

    const session = await this.verifySession(sessionToken);
    if (!session) throw ForbiddenError("Sessão inválida");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("Usuário não encontrado");

    // Revogação ativa: o JWT em si só prova que foi emitido validamente um
    // dia (assinatura + prazo), nunca que a conta continua liberada agora —
    // sem isto, pausar uma conta (team.setActive) ou trocar a senha
    // (team.update) não tinha efeito nenhum sobre sessões já emitidas, que
    // seguiam válidas até o token expirar sozinho (por padrão, ONE_YEAR_MS).
    // Mesmo padrão já usado no saas-core (ctx.platformAdmin.active recarregado
    // do banco a cada request, ver saas-core/server/_core/trpc.ts). Só se
    // aplica a staff/admin: é o único jeito de um token existir hoje (login
    // sempre passa por authenticateRestaurantAccount).
    if (user.role === "staff" || user.role === "admin") {
      const active = await db.getStaffCredentialActiveStatus(user.id);
      if (active === false) throw ForbiddenError("Sessão inválida");
    }

    // `lastSignedIn` só precisa ser aproximado (é exibido como "visto por
    // último", nunca usado em regra de negócio) — regravar a cada request
    // custava um INSERT...ON DUPLICATE KEY UPDATE a cada poll do admin (a
    // cada 8-10s, por tela aberta). Atualiza no máximo a cada 5 minutos.
    const lastSignedInStale = Date.now() - user.lastSignedIn.getTime() > LAST_SIGNED_IN_REFRESH_MS;
    if (lastSignedInStale) {
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });
    }

    return user;
  }
}

export const sdk = new SessionService();
