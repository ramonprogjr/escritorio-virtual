import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import "./globals.css";

/** Fora do chunk crítico app/layout.js — evita ChunkLoadError por bundle pesado (MobileShell/Supabase). */
const MobileDetector = dynamic(() => import("@/components/mobile/MobileDetector"));

const IOSInstallBanner = dynamic(() => import("@/components/IOSInstallBanner"));

const ToastViewport = dynamic(() =>
  import("@/components/crm/toast").then((m) => m.ToastViewport),
);

// FONTES: carregadas via <link> em runtime (browser baixa do Google), NÃO no build.
// Antes usávamos next/font/google, que baixa as fontes DURANTE o build — e o build do
// Render falhava quando não conseguia alcançar o Google Fonts (deploys travados).
// As variáveis --font-* são definidas em globals.css (:root).

export const metadata: Metadata = {
  title: "Obra10+",
  description:
    "Hub Obra10+ — CRM, funis comerciais, WhatsApp com IA, multi-agente e gestão financeira para construção e mercado imobiliário.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Obra10+",
  },
  icons: {
    icon: [
      { url: "/icon", sizes: "512x512", type: "image/png" },
      { url: "/icon", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Obra10+",
    "msapplication-TileColor": "#003b26",
  },
};

export const viewport: Viewport = {
  themeColor: "#003b26",
  width: "device-width",
  initialScale: 1,
  // a11y (WCAG 1.4.4): permitir zoom/pinch — removidos maximumScale:1 e userScalable:false.
  // O auto-zoom de input do iOS já é evitado por font-size:16px nos inputs (globals.css), não aqui.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Playfair+Display:wght@600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <MobileDetector>{children}</MobileDetector>
        <IOSInstallBanner />
        <ToastViewport />
      </body>
    </html>
  );
}
