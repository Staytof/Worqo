import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import logoImg from "../../../assets/086f960c8661a1671180afefed41bf6bef99edd4.png";
import { getInitials } from "../../utils/helpers";

const COLLISION_STAGE_DELAY_MS = 1500;
const TRANSITION_FINISH_DELAY_MS = 3800;
const AVATAR_TRAVEL_DURATION_S = 0.95;
const COLLISION_FLASH_DURATION_S = 1.25;
const COLLISION_FADE_DURATION_S = 0.45;
const BRAND_REVEAL_DURATION_S = 0.72;

type WorkoMatchTransitionProps = {
  isOpen: boolean;
  currentUserName: string;
  currentUserAvatar?: string | null;
  partnerName: string;
  partnerAvatar?: string | null;
  onFinish: () => void;
};

export function WorkoMatchTransition({
  isOpen,
  currentUserName,
  currentUserAvatar = null,
  partnerName,
  partnerAvatar = null,
  onFinish,
}: WorkoMatchTransitionProps) {
  const [stage, setStage] = useState<"collision" | "brand">("collision");
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (!isOpen) {
      setStage("collision");
      return;
    }

    setStage("collision");

    const brandTimeoutId = window.setTimeout(() => {
      setStage("brand");
    }, COLLISION_STAGE_DELAY_MS);

    const finishTimeoutId = window.setTimeout(() => {
      onFinishRef.current();
    }, TRANSITION_FINISH_DELAY_MS);

    return () => {
      window.clearTimeout(brandTimeoutId);
      window.clearTimeout(finishTimeoutId);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] overflow-hidden bg-blue-700"
    >

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={
            stage === "collision"
              ? { opacity: 1 }
              : { opacity: 0, scale: 1.04, filter: "blur(4px)" }
          }
          transition={{
            duration: stage === "collision" ? 0.35 : COLLISION_FADE_DURATION_S,
          }}
          className="relative mb-8 h-80 w-full max-w-sm"
        >
          <motion.div
            initial={{ opacity: 0.2, scale: 0.9 }}
            animate={
              stage === "collision"
                ? {
                    opacity: [0.15, 0.4, 0.22],
                    scale: [0.9, 1.08, 1.18],
                  }
                : { opacity: 0.22, scale: 1.26 }
            }
            transition={{
              duration: stage === "collision" ? COLLISION_FLASH_DURATION_S : 1.2,
              times: stage === "collision" ? [0, 0.55, 1] : undefined,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-200/30 bg-yellow-300/10 shadow-[0_0_80px_rgba(250,204,21,0.12)]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={
              stage === "collision"
                ? {
                    opacity: [0, 0.1, 0.55, 0.18, 0],
                    scale: [0.3, 0.8, 1.35, 1.9, 2.4],
                  }
                : { opacity: 0, scale: 2.4 }
            }
            transition={{
              duration: COLLISION_FLASH_DURATION_S,
              times: [0, 0.18, 0.42, 0.72, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/25"
          />

          <motion.div
            initial={{ x: -140, y: 10, rotate: -8, scale: 0.9 }}
            animate={{
              x: [-140, -54, -14],
              y: [10, -6, 0],
              rotate: [-8, -2, 0],
              scale: [0.9, 1.03, 1],
            }}
            transition={{ duration: AVATAR_TRAVEL_DURATION_S, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative h-28 w-28 rounded-full border-4 border-white/70 bg-white/18 p-1 shadow-[0_24px_48px_rgba(2,6,23,0.28)] backdrop-blur-xl">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-blue-600 text-3xl font-bold text-white">
                {currentUserAvatar ? (
                  <img
                    src={currentUserAvatar}
                    alt={currentUserName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(currentUserName || "Usuário")
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 140, y: -10, rotate: 8, scale: 0.9 }}
            animate={{
              x: [140, 54, 14],
              y: [-10, 6, 0],
              rotate: [8, 2, 0],
              scale: [0.9, 1.03, 1],
            }}
            transition={{ duration: AVATAR_TRAVEL_DURATION_S, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="relative h-28 w-28 rounded-full border-4 border-white/70 bg-white/18 p-1 shadow-[0_24px_48px_rgba(2,6,23,0.28)] backdrop-blur-xl">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-200 text-3xl font-bold text-slate-700">
                {partnerAvatar ? (
                  <img
                    src={partnerAvatar}
                    alt={partnerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(partnerName || "Profissional")
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={
              stage === "collision"
                ? { opacity: [0, 0.22, 0.48, 0], scale: [0.7, 1, 1.08, 1.28] }
                : { opacity: 0, scale: 1.28 }
            }
            transition={{
              duration: COLLISION_FLASH_DURATION_S,
              times: [0, 0.3, 0.56, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/55"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.92 }}
          animate={
            stage === "brand"
              ? { opacity: 1, y: 0, scale: 1 }
              : { opacity: 0, y: 26, scale: 0.92 }
          }
          transition={{ duration: BRAND_REVEAL_DURATION_S, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex max-w-xs flex-col items-center"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-[30px] bg-white/14 p-4 shadow-[0_24px_60px_rgba(2,6,23,0.28)] backdrop-blur-xl">
            <img src={logoImg} alt="Worko" className="h-full w-full object-contain" />
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.34em] text-yellow-200/90">
            Pagamento protegido
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-white">
            Você deu um Worko!
          </h2>
        </motion.div>
      </div>
    </motion.div>
  );
}
