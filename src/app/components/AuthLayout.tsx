import { motion } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useApp } from "../context/AppContext";
import { useBootSplash } from "../hooks/useBootSplash";
import { useNativePermissionBootstrap } from "../hooks/useNativePermissionBootstrap";
import { BrandSplash } from "./BrandSplash";

function AuthLoadingScreen() {
  return <BrandSplash />;
}

export function AuthLayout() {
  const {
    state: { authReady, isAuthenticated, onboardingStep, user },
  } = useApp();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bootSplashVisible = useBootSplash();

  useLayoutEffect(() => {
    containerRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [location.pathname]);

  useNativePermissionBootstrap(!bootSplashVisible);

  if (!authReady || bootSplashVisible) {
    return <AuthLoadingScreen />;
  }

  const redirectPath =
    isAuthenticated && user?.isAdmin
      ? "/admin"
      : onboardingStep === "verify"
      ? "/verify"
      : onboardingStep === "profile-setup"
        ? "/profile-setup"
        : isAuthenticated
          ? "/app"
          : null;

  if (redirectPath && location.pathname !== redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  const isLoginRoute = location.pathname === "/";
  const isProfileSetupRoute = location.pathname === "/profile-setup";

  return (
    <div
      ref={containerRef}
      className={`auth-layout-shell relative min-h-screen w-full overflow-x-hidden font-sans ${
        isLoginRoute
          ? "overflow-y-auto bg-white"
          : isProfileSetupRoute
            ? "overflow-y-auto bg-white"
            : "flex items-start justify-center overflow-y-auto bg-[#f4f7fa] p-4 py-6 sm:items-center sm:p-6 sm:py-10"
      }`}
      style={
        isLoginRoute || isProfileSetupRoute
          ? undefined
          : {
              paddingTop: "calc(24px + env(safe-area-inset-top, 0px))",
              paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
              paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
              paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
            }
      }
    >
      {!isLoginRoute && !isProfileSetupRoute ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <motion.div
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-400 opacity-40 mix-blend-multiply blur-3xl filter"
          />
          <motion.div
            animate={{
              x: [0, -80, 0],
              y: [0, 60, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className="absolute -right-20 top-20 h-80 w-80 rounded-full bg-amber-300 opacity-30 mix-blend-multiply blur-3xl filter"
          />
          <motion.div
            animate={{
              x: [0, 50, 0],
              y: [0, 80, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 4,
            }}
            className="absolute -bottom-40 left-1/4 h-[500px] w-[500px] rounded-full bg-blue-600 opacity-20 mix-blend-multiply blur-3xl filter"
          />
        </div>
      ) : null}

      <Outlet />
    </div>
  );
}
