import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pas de badge de développement par-dessus la barre latérale
  devIndicators: false,
  // Images du contenu servies par le stockage objet (ou le serveur de développement)
  images: { unoptimized: true },
};

export default nextConfig;
