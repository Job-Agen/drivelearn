import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pg"],
  // Envoi d'images (4 Mo au maximum, voir lib/images.ts) par les actions serveur.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default config;
