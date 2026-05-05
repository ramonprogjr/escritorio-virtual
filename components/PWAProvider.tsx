"use client";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAProvider() {
  const [promptInstalacao, setPromptInstalacao] = useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarBanner, setMostrarBanner] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(reg => console.log("SW registrado:", reg.scope))
        .catch(err => console.error("SW erro:", err));
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptInstalacao(e as BeforeInstallPromptEvent);
      const jaInstalou = localStorage.getItem("pwa_instalado");
      const jaDismissed = localStorage.getItem("pwa_dismissed");
      if (!jaInstalou && !jaDismissed) {
        setTimeout(() => setMostrarBanner(true), 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function instalar() {
    if (!promptInstalacao) return;
    promptInstalacao.prompt();
    const { outcome } = await promptInstalacao.userChoice;
    if (outcome === "accepted") localStorage.setItem("pwa_instalado", "true");
    setMostrarBanner(false);
    setPromptInstalacao(null);
  }

  function dispensar() {
    localStorage.setItem("pwa_dismissed", "true");
    setMostrarBanner(false);
  }

  if (!mostrarBanner) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl p-4 shadow-2xl"
      style={{ background: "#161b22", border: "1px solid #c9a24a44" }}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xl"
          style={{ background: "#003b26", color: "#c9a24a" }}>O+</div>
        <div className="flex-1">
          <p className="text-white font-bold text-sm">Instalar Obra10+</p>
          <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>
            Adicione à tela inicial para acesso rápido
          </p>
        </div>
        <button onClick={dispensar} style={{ color: "#484f58", background: "none", border: "none", cursor: "pointer" }}>✕</button>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={instalar} className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm"
          style={{ background: "#003b26", border: "none", cursor: "pointer" }}>
          Instalar app
        </button>
        <button onClick={dispensar} className="px-4 py-2.5 rounded-xl text-sm"
          style={{ background: "#21262d", color: "#8b949e", border: "none", cursor: "pointer" }}>
          Agora não
        </button>
      </div>
    </div>
  );
}
