export type Queryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
};

import type { PaymentGateway } from "./paygate.js";

export type Identity = { userId: string; email: string | null; emailVerified: boolean };
export type TokenVerifier = (token: string) => Promise<Identity>;
export type AuthAdmin = { deleteUser(userId: string): Promise<void> };

export type Deps = {
  db: Queryable;
  verifyToken: TokenVerifier;
  authAdmin: AuthAdmin;
  requireVerifiedEmail: boolean;
  imagesBaseUrl: string | null;
  gateway: PaymentGateway;
};

export type AppEnv = { Variables: { userId: string } };
