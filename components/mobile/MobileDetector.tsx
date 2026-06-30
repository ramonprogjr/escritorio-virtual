"use client";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";

const MobileShell = dynamic(() => import("./MobileShell"), { ssr: false });

interface Props { children: React.ReactNode; }

function mobileFallback(children: React.ReactNode) {
  return (
    <div className="min-h-[100dvh]" style={{ background: "#0a140f" }}>
      {children}
    </div>
  );
}

function isHubPublicRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/cadastre-se") || pathname === "/login" || pathname.startsWith("/login/");
}

export default function MobileDetector({ children }: Props) {
  const pathname = usePathname();
  const narrow = useNarrowViewport();

  if (isHubPublicRoute(pathname)) {
    return <>{children}</>;
  }

  if (narrow === null) {
    return mobileFallback(children);
  }

  if (narrow) {
    return (
      <Suspense fallback={mobileFallback(children)}>
        <MobileShell>{children}</MobileShell>
      </Suspense>
    );
  }

  return <>{children}</>;
}
