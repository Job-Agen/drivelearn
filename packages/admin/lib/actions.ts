import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminMessage } from "./errors";

function withFlash(url: string, kind: "ok" | "error", message: string): string {
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.delete("ok");
  params.delete("error");
  params.set(kind, message);
  return `${path}?${params.toString()}`;
}

/** Exécute une action serveur puis redirige avec un message de réussite ou d'erreur. */
export async function runAction(backTo: string, fn: () => Promise<string | void>): Promise<never> {
  let target: string;
  try {
    const next = await fn();
    target = withFlash(next ?? backTo, "ok", "Enregistré.");
  } catch (error) {
    target = withFlash(backTo, "error", adminMessage(error));
  }
  revalidatePath("/", "layout");
  redirect(target);
}
