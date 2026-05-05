"use client";
import { useEffect, useState } from "react";
import MobileShell from "./MobileShell";

interface Props { children: React.ReactNode; }

export default function MobileDetector({ children }: Props) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile === null) {
    return <div style={{ background: "#0d1117", minHeight: "100vh" }}>{children}</div>;
  }

  if (isMobile) {
    return <MobileShell>{children}</MobileShell>;
  }

  return <>{children}</>;
}
