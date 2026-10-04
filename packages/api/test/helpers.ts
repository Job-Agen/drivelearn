import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { withTx, type Db } from "../../db/test/helpers.js";
import { createApp } from "../src/app.js";
import { createTokenVerifier } from "../src/auth.js";
import type { GatewayStatus, Network, PaymentGateway } from "../src/paygate.js";
import { GatewayError } from "../src/paygate.js";
import type { Queryable } from "../src/types.js";

/** Passerelle simulée : on décide du statut renvoyé par « PayGate » pour chaque paiement. */
export type FakeGateway = PaymentGateway & {
  initiated: { identifier: string; amount: number; phone: string; network: Network }[];
  remote: Map<string, GatewayStatus>;
  failNext: "invalid_phone" | "gateway_unavailable" | null;
};

export function fakeGateway(): FakeGateway {
  const g: FakeGateway = {
    initiated: [],
    remote: new Map(),
    failNext: null,
    async initiate(p) {
      if (g.failNext) {
        const code = g.failNext;
        g.failNext = null;
        throw new GatewayError(code, code === "invalid_phone" ? "Numéro invalide." : "Passerelle indisponible.");
      }
      g.initiated.push(p);
      return { txReference: `TX-${p.identifier.slice(0, 8)}` };
    },
    async status(identifier) {
      return { status: g.remote.get(identifier) ?? "pending", txReference: `TX-${identifier.slice(0, 8)}`, method: "FLOOZ" };
    },
  };
  return g;
}

export const TEST_ISSUER = "https://auth.drivelearn.test";

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "test", alg: "EdDSA" }] });

export async function signToken(
  userId: string,
  opts: { emailVerified?: boolean; expiresAt?: number; issuer?: string; key?: CryptoKey } = {},
): Promise<string> {
  return new SignJWT({ email: `${userId}@test.tg`, emailVerified: opts.emailVerified ?? true })
    .setProtectedHeader({ alg: "EdDSA", kid: "test" })
    .setSubject(userId)
    .setIssuer(opts.issuer ?? TEST_ISSUER)
    .setIssuedAt()
    .setExpirationTime(opts.expiresAt ?? "15m")
    .sign(opts.key ?? privateKey);
}

/** Chaque requête dans son point de sauvegarde : une erreur SQL n'empoisonne pas la transaction de test,
 *  comme en production où chaque requête est atomique d'elle-même. */
function statementAtomic(db: Db): Queryable {
  return {
    async query(text, values) {
      await db.query("savepoint api_stmt");
      try {
        const result = await db.query(text, values);
        await db.query("release savepoint api_stmt");
        return result;
      } catch (error) {
        await db.query("rollback to savepoint api_stmt");
        throw error;
      }
    },
  };
}

export type TestResponse = { status: number; body: any };
export type TestApi = {
  request(
    method: string,
    path: string,
    opts?: { user?: string; token?: string; body?: unknown },
  ): Promise<TestResponse>;
  /** Envoie un corps brut, tel quel (pour tester un JSON mal formé). */
  raw(method: string, path: string, body: string, token: string): Promise<TestResponse>;
  deleted: string[];
  gateway: FakeGateway;
};

/** Application complète branchée sur une transaction annulée à la fin du test. */
export function withApp<T>(
  fn: (api: TestApi, db: Db) => Promise<T>,
  opts: { requireVerifiedEmail?: boolean; failAuthDelete?: boolean } = {},
): Promise<T> {
  return withTx(async (db) => {
    const deleted: string[] = [];
    const gateway = fakeGateway();
    const app = createApp({
      gateway,
      db: statementAtomic(db),
      verifyToken: createTokenVerifier({ keys: jwks, issuer: TEST_ISSUER }),
      authAdmin: {
        async deleteUser(userId) {
          if (opts.failAuthDelete) throw new Error("Neon Auth indisponible");
          deleted.push(userId);
        },
      },
      requireVerifiedEmail: opts.requireVerifiedEmail ?? true,
      imagesBaseUrl: "https://images.drivelearn.test",
    });
    const request: TestApi["request"] = async (method, path, o = {}) => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const token = o.token ?? (o.user ? await signToken(o.user) : undefined);
      if (token) headers.authorization = `Bearer ${token}`;
      const res = await app.request(path, {
        method,
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    };
    const raw: TestApi["raw"] = async (method, path, body, token) => {
      const res = await app.request(path, {
        method,
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body,
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    };
    return fn({ request, raw, deleted, gateway }, db);
  });
}
