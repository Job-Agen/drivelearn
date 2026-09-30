export type Queryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
};

export type Identity = { userId: string; email: string | null; emailVerified: boolean };
export type TokenVerifier = (token: string) => Promise<Identity>;
export type AuthAdmin = { deleteUser(userId: string): Promise<void> };

export type Deps = {
  db: Queryable;
  verifyToken: TokenVerifier;
  authAdmin: AuthAdmin;
  requireVerifiedEmail: boolean;
  imagesBaseUrl: string | null;
};

export type AppEnv = { Variables: { userId: string } };
