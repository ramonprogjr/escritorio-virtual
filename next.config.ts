import type { NextConfig } from "next";
import path from "path";

/**
 * distDir tem de ser relativo à raiz do projeto (Next.js não aceita path absoluto).
 * Em dev usamos `.next-dev` separado para reduzir conflito com cache antigo / OneDrive.
 */
const nextConfig: NextConfig = {
  /** Oculta o badge flutuante "N" do Next.js em dev (sobrepunha a barra mobile). */
  devIndicators: false,
  /** pdfkit lê fontes .afm em disco — não pode ir no bundle webpack/turbopack. */
  serverExternalPackages: ["pdfkit", "fontkit"],
  ...(process.env.NODE_ENV === "development"
    ? { distDir: process.env.NEXT_DIST_DIR?.trim() || ".next-dev" }
    : {}),
  /**
   * Mantemos bloco turbos explícito para compatibilizar Next 16 quando
   * também há customizações de webpack (usadas no modo dev --webpack).
   */
  turbopack: { root: path.resolve(".") },
  webpack: (config, { dev, isServer }) => {
    if (isServer) {
      const prev = config.externals;
      const extra = ["pdfkit", "fontkit"];
      config.externals = Array.isArray(prev) ? [...prev, ...extra] : prev ? [prev, ...extra] : extra;
    }
    if (dev) {
      // Evita falhas de PackFileCacheStrategy (rename/open) em pastas sincronizadas pelo OneDrive.
      config.cache = false;
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: "/crm/kpis",
        destination: "/crm/analytics",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
