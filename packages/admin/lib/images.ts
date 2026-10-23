import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AdminError } from "./errors";

// Images des questions et des leçons : bucket Neon en lecture publique.
// La base ne garde que la clé de l'objet (ex. « images/2026/….png ») ; l'API et l'application
// la préfixent avec IMAGES_BASE_URL, comme ici pour l'aperçu.

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // sous la limite de corps de requête de Vercel (4,5 Mo)

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const ACCEPTED_IMAGES = Object.keys(TYPES).join(",");

/** Adresse publique d'une image (clé de stockage ou adresse complète), ou null. */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = process.env.IMAGES_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : null;
}

let client: S3Client | undefined;

function storage(): { client: S3Client; bucket: string } {
  const { STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET } = process.env;
  if (!STORAGE_ENDPOINT || !STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY || !STORAGE_BUCKET) {
    throw new AdminError("L'envoi d'images n'est pas configuré sur ce serveur.");
  }
  client ??= new S3Client({
    region: STORAGE_REGION || "eu-central-1",
    endpoint: STORAGE_ENDPOINT,
    credentials: { accessKeyId: STORAGE_ACCESS_KEY_ID, secretAccessKey: STORAGE_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });
  return { client, bucket: STORAGE_BUCKET };
}

/** Vérifie et envoie une image ; renvoie sa clé de stockage. */
export async function uploadImage(file: File): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new AdminError("Format d'image non accepté : PNG, JPEG ou WebP uniquement.");
  if (file.size > MAX_IMAGE_BYTES) throw new AdminError("Image trop lourde : 4 Mo au maximum.");
  const key = `images/${new Date().getUTCFullYear()}/${randomUUID()}.${ext}`;
  const { client, bucket } = storage();
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    console.error(error);
    throw new AdminError("L'envoi de l'image a échoué. Réessayez.");
  }
  return key;
}

/**
 * Valeur finale d'un champ image d'un formulaire (voir <ImageField name=…>) :
 * le nouveau fichier s'il y en a un, rien si « Retirer l'image » est coché, sinon l'image actuelle.
 */
export async function imageFromForm(formData: FormData, name: string): Promise<string | null> {
  const file = formData.get(`${name}_file`);
  if (file instanceof File && file.size > 0) return uploadImage(file);
  if (formData.get(`${name}_remove`) === "on") return null;
  return String(formData.get(name) ?? "").trim() || null;
}
