import type { AuthAdmin } from "./types.js";

/** Suppression d'un compte via l'API de gestion Neon (l'élève ne peut pas le faire lui-même avec Neon Auth). */
export function createNeonAuthAdmin(opts: {
  apiKey: string;
  projectId: string;
  branchId: string;
  fetch?: typeof fetch;
}): AuthAdmin {
  const doFetch = opts.fetch ?? fetch;
  return {
    async deleteUser(userId) {
      const url = `https://console.neon.tech/api/v2/projects/${opts.projectId}/branches/${opts.branchId}/auth/users/${encodeURIComponent(userId)}`;
      const res = await doFetch(url, {
        method: "DELETE",
        headers: { authorization: `Bearer ${opts.apiKey}`, accept: "application/json" },
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Neon Auth a refusé la suppression (${res.status})`);
      }
    },
  };
}
