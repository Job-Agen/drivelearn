import type { MiddlewareHandler } from "hono";
import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { HttpError } from "./errors.js";
import type { AppEnv, Deps, Identity, TokenVerifier } from "./types.js";

export function createTokenVerifier(opts: { keys: JWTVerifyGetKey; issuer: string }): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, opts.keys, { issuer: opts.issuer });
    if (!payload.sub) throw new Error("Jeton sans sujet");
    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: payload.emailVerified === true,
    };
  };
}

export function authMiddleware(deps: Deps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(401, "unauthorized", "Connexion requise.");
    }
    let identity: Identity;
    try {
      identity = await deps.verifyToken(header.slice(7).trim());
    } catch {
      throw new HttpError(401, "unauthorized", "Session expirée. Reconnectez-vous.");
    }
    if (deps.requireVerifiedEmail && !identity.emailVerified) {
      throw new HttpError(403, "email_not_verified", "Vérifiez votre adresse e-mail pour continuer.");
    }
    await deps.db.query("select ensure_profile($1, $2)", [identity.userId, identity.email]);
    c.set("userId", identity.userId);
    await next();
  };
}
