"use client";
import MobileShell from "./MobileShell";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";

interface Props { children: React.ReactNode; }

export default function MobileDetector({ children }: Props) {
  const narrow = useNarrowViewport();

  if (narrow === null) {
    return (
      <div className="min-h-[100dvh]" style={{ background: "#0d1117" }}>
        {children}
      </div>
    );
  }

  if (narrow) {
    return <MobileShell>{children}</MobileShell>;
  }

  return <>{children}</>;
}
