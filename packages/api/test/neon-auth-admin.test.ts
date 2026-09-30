import { describe, expect, it } from "vitest";
import { createNeonAuthAdmin } from "../src/neon-auth-admin.js";

function fakeFetch(status: number) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("suppression d'un utilisateur Neon Auth", () => {
  it("appelle l'API de gestion Neon avec la clé", async () => {
    const f = fakeFetch(200);
    await createNeonAuthAdmin({ apiKey: "cle", projectId: "proj", branchId: "br-1", fetch: f.fn }).deleteUser("u 1");
    expect(f.calls[0].url).toBe("https://console.neon.tech/api/v2/projects/proj/branches/br-1/auth/users/u%201");
    expect(f.calls[0].init.method).toBe("DELETE");
    expect((f.calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer cle");
  });

  it("considère un utilisateur déjà absent comme supprimé", async () => {
    const f = fakeFetch(404);
    await expect(createNeonAuthAdmin({ apiKey: "k", projectId: "p", branchId: "b", fetch: f.fn }).deleteUser("u")).resolves.toBeUndefined();
  });

  it("signale un refus de Neon", async () => {
    const f = fakeFetch(500);
    await expect(createNeonAuthAdmin({ apiKey: "k", projectId: "p", branchId: "b", fetch: f.fn }).deleteUser("u")).rejects.toThrow("500");
  });
});
