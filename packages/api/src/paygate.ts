// Passerelle mobile money PayGate Global (Togo : Flooz, T-Money).
// API v1 « pay » pour lancer le paiement sur le téléphone de l'élève, API v2 « status » pour le vérifier
// avec notre propre identifiant (l'id du paiement). Les notifications de PayGate ne sont pas signées :
// on ne les croit jamais sur parole, on redemande toujours le statut à PayGate.

export type Network = "FLOOZ" | "TMONEY";
export type GatewayStatus = "paid" | "pending" | "expired" | "cancelled";

export type PaymentGateway = {
  initiate(p: { identifier: string; amount: number; phone: string; network: Network; description: string }): Promise<{ txReference: string | null }>;
  status(identifier: string): Promise<{ status: GatewayStatus; txReference: string | null; method: string | null }>;
};

/** Refus de la passerelle, avec un message affichable à l'élève. */
export class GatewayError extends Error {
  constructor(
    readonly code: "invalid_phone" | "gateway_unavailable",
    message: string,
  ) {
    super(message);
  }
}

const BASE = "https://paygateglobal.com/api";
const STATUS: Record<number, GatewayStatus> = { 0: "paid", 2: "pending", 4: "expired", 6: "cancelled" };

export function createPayGate(opts: { authToken: string; fetch?: typeof fetch }): PaymentGateway {
  const doFetch = opts.fetch ?? fetch;
  const post = async (path: string, body: Record<string, unknown>) => {
    let res: Response;
    try {
      res = await doFetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ auth_token: opts.authToken, ...body }),
      });
    } catch {
      throw new GatewayError("gateway_unavailable", "Le service de paiement ne répond pas. Réessaie dans un instant.");
    }
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !json) throw new GatewayError("gateway_unavailable", "Le service de paiement ne répond pas. Réessaie dans un instant.");
    return json;
  };

  return {
    async initiate(p) {
      const json = await post("/v1/pay", {
        phone_number: p.phone,
        amount: p.amount,
        description: p.description,
        identifier: p.identifier,
        network: p.network,
      });
      const code = Number(json.status);
      if (code === 0) return { txReference: json.tx_reference == null ? null : String(json.tx_reference) };
      if (code === 4) throw new GatewayError("invalid_phone", "Numéro ou réseau invalide. Vérifie ton numéro mobile money.");
      // 2 : jeton invalide (configuration), 6 : doublon
      console.error("PayGate a refusé le paiement", code);
      throw new GatewayError("gateway_unavailable", "Le paiement n'a pas pu être lancé. Réessaie dans un instant.");
    },

    async status(identifier) {
      const json = await post("/v2/status", { identifier });
      const status = STATUS[Number(json.status)];
      if (!status) throw new GatewayError("gateway_unavailable", "Statut du paiement inconnu.");
      return {
        status,
        txReference: json.tx_reference == null ? null : String(json.tx_reference),
        method: json.payment_method == null ? null : String(json.payment_method),
      };
    },
  };
}
