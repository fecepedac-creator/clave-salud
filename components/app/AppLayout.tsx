import React from "react";
import Breadcrumbs from "../Breadcrumbs";
import { CenterContext } from "../../CenterContext";
import { ViewMode } from "../../types";

export const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
    <p className="text-slate-500 text-lg font-medium animate-pulse">Cargando...</p>
  </div>
);

export const HomeBackdrop: React.FC<{
  homeBgSrc: string;
  homeBgFallbackSrc: string;
  children: React.ReactNode;
}> = ({ homeBgSrc, homeBgFallbackSrc, children }) => (
  <div
    className="home-hero relative min-h-dvh w-full overflow-hidden"
    style={
      {
        "--home-hero-image": `image-set(url("${homeBgSrc}") type("image/webp"), url("${homeBgFallbackSrc}") type("image/png"))`,
      } as React.CSSProperties
    }
  >
    <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-white/2 to-white/8 pointer-events-none" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.04),_transparent_55%)] pointer-events-none" />
    <div className="relative z-10 min-h-dvh w-full">{children}</div>
  </div>
);

export const CenterBackdrop: React.FC<{
  centerBgSrc: string;
  centerBgFallbackSrc: string;
  children: React.ReactNode;
}> = ({ centerBgSrc, centerBgFallbackSrc, children }) => (
  <div
    className="center-hero relative min-h-dvh w-full overflow-hidden"
    style={
      {
        "--center-hero-image": `image-set(url("${centerBgSrc}") type("image/webp"), url("${centerBgFallbackSrc}") type("image/png"))`,
      } as React.CSSProperties
    }
  >
    <div className="absolute inset-0 bg-white/20 pointer-events-none" />
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,_rgba(14,116,144,0.08),_transparent_45%)] pointer-events-none" />
    <div className="relative z-10 min-h-dvh w-full">{children}</div>
  </div>
);

export const ViewContainer: React.FC<{
  view: ViewMode;
  centerCtxValue: React.ContextType<typeof CenterContext>;
  activeCenterName?: string;
  onNavigate: (view: ViewMode) => void;
  showBreadcrumbs?: boolean;
  children: React.ReactNode;
}> = ({
  view,
  centerCtxValue,
  activeCenterName,
  onNavigate,
  showBreadcrumbs = true,
  children,
}) => (
  <CenterContext.Provider value={centerCtxValue}>
    <div
      key={view}
      className="animate-fadeIn min-h-screen w-full relative"
      data-testid={`view-container-${view}`}
    >
      {showBreadcrumbs && view !== "home" && (
        <div
          className={`fixed top-2 z-50 pointer-events-auto transition-all duration-300 ${
            view === "doctor-dashboard"
              ? "left-4 lg:left-[calc(var(--doctor-sidebar-width,18rem)+1.5rem)]"
              : "left-4"
          }`}
        >
          <Breadcrumbs
            view={view}
            centerName={activeCenterName}
            onNavigate={(v) => onNavigate(v as ViewMode)}
          />
        </div>
      )}
      {children}
    </div>
  </CenterContext.Provider>
);
