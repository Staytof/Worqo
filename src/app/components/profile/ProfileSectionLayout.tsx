import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useLocation } from "react-router";
import { FloatingBackButton } from "../ui/FloatingBackButton";

type ProfileSectionLayoutProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
};

export function ProfileSectionLayout({
  eyebrow,
  title,
  description,
  children,
}: ProfileSectionLayoutProps) {
  const location = useLocation();
  const hasHeaderCopy = Boolean(eyebrow || title || description);
  const showProfileBackButton = location.pathname.startsWith("/app/profile/");

  return (
    <div className="min-h-full worqo-page">
      {showProfileBackButton ? (
        <div
          className="fixed left-4 z-[60]"
          style={{ top: "calc(16px + env(safe-area-inset-top, 0px))" }}
        >
          <FloatingBackButton
            to="/app/profile"
            fallbackTo="/app"
            ariaLabel="Voltar"
            className="h-12 w-12 bg-white/95 text-slate-700 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
          />
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6">
        {hasHeaderCopy ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="worqo-section min-w-0 px-0 py-5 pl-16"
          >
            <div className="min-w-0">
              {eyebrow ? (
                <p className="break-words text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                  {eyebrow}
                </p>
              ) : null}
              {title ? (
                <h1 className="mt-2 break-words text-2xl font-bold text-slate-900 font-['Nunito']">
                  {title}
                </h1>
              ) : null}
              {description ? (
                <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed text-slate-500">
                  {description}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="grid min-w-0 gap-4"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
