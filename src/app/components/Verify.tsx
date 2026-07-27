import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { Link, Navigate, useNavigate } from "react-router";
import { LEGAL_VERSION } from "../content/legal";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import { maskEmail } from "../utils/helpers";

export function Verify() {
  const navigate = useNavigate();
  const {
    state: { isAuthenticated, onboardingStep, pendingVerification },
    completeVerification,
    requestVerificationCode,
    logout,
  } = useApp();
  const [token, setToken] = useState(["", "", "", "", "", ""]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useErrorToast(error);

  useEffect(() => {
    let ignore = false;

    async function sendInitialCode() {
      if (!pendingVerification) {
        return;
      }

      setIsSending(true);
      const result = await requestVerificationCode();

      if (!ignore) {
        setIsSending(false);
        setError(result.ok ? "" : result.error ?? "Não conseguimos enviar o código.");
      }
    }

    if (onboardingStep === "verify") {
      void sendInitialCode();
    }

    return () => {
      ignore = true;
    };
  }, [onboardingStep, pendingVerification?.userId, requestVerificationCode]);

  if (isAuthenticated && onboardingStep === "profile-setup") {
    return <Navigate to="/profile-setup" replace />;
  }

  if (isAuthenticated && onboardingStep === "app") {
    return <Navigate to="/app" replace />;
  }

  if (onboardingStep !== "verify" || !pendingVerification) {
    return <Navigate to="/" replace />;
  }

  const handleBackToLogin = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleTokenChange = (index: number, value: string) => {
    const safeValue = value.replace(/\D/g, "").slice(0, 1);
    const nextToken = [...token];
    nextToken[index] = safeValue;
    setToken(nextToken);

    if (safeValue && index < 5) {
      const nextInput = document.getElementById(`token-${index + 1}`) as HTMLInputElement | null;
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !token[index] && index > 0) {
      const previousInput = document.getElementById(
        `token-${index - 1}`
      ) as HTMLInputElement | null;
      previousInput?.focus();
    }
  };

  const handleResend = async () => {
    setToken(["", "", "", "", "", ""]);
    setIsSending(true);

    const result = await requestVerificationCode();

    setIsSending(false);
    setError(result.ok ? "" : result.error ?? "Não conseguimos reenviar o código.");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const result = await completeVerification({
      code: token.join(""),
      acceptTerms: accepted,
      acceptPrivacy: accepted,
      legalVersion: LEGAL_VERSION,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Não conseguimos validar o código.");
      return;
    }

    setError("");
    navigate("/profile-setup");
  };

  const isComplete = token.every((digit) => digit !== "") && accepted;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 flex w-full max-w-md flex-col items-center rounded-[2rem] border border-white/50 bg-white px-5 py-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:px-8 sm:py-8 md:p-10"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 150 }}
        className="mb-8 flex w-full flex-col items-center text-center"
      >
        <button
          type="button"
          onClick={() => {
            void handleBackToLogin();
          }}
          className="mb-4 mr-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          aria-label="Voltar ao login"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500 shadow-sm">
          <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 blur-md" />
          <ShieldCheck className="relative z-10 h-8 w-8" />
        </div>
        <h1
          className="text-2xl font-bold tracking-tight text-slate-800"
          style={{ fontFamily: "'Nunito', sans-serif" }}
        >
          Confirme seu e-mail
        </h1>
      </motion.div>

      <form className="w-full space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="flex flex-col items-start gap-2 text-sm font-medium text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex flex-col gap-1">
              <span>Código de confirmação</span>
              <span className="text-xs font-normal text-slate-500">
                Enviado para {maskEmail(pendingVerification.email)}
              </span>
            </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={isSending}
              className={`text-xs ${
                isSending
                  ? "cursor-not-allowed text-slate-400"
                  : "cursor-pointer text-blue-600 hover:underline"
              }`}
            >
              {isSending ? "Reenviando..." : "Reenviar código"}
            </button>
          </label>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {token.map((digit, index) => (
              <input
                key={index}
                id={`token-${index}`}
                type="text"
                maxLength={1}
                inputMode="numeric"
                value={digit}
                onChange={(event) => handleTokenChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                className="h-12 min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 text-center text-lg font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] sm:h-14 sm:text-xl"
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-medium text-slate-700">
              Termos de uso e privacidade
            </label>
            <Link
              to="/legal"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Abrir em tela cheia
            </Link>
          </div>

          <label className="group flex cursor-pointer items-start gap-3 pt-1">
            <div
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-all ${
                accepted
                  ? "border-blue-500 bg-blue-500"
                  : "border-slate-300 bg-white group-hover:border-blue-400"
              }`}
            >
              {accepted ? <Check className="h-3.5 w-3.5 text-white" /> : null}
            </div>
            <input
              type="checkbox"
              className="hidden"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span className="select-none text-sm text-slate-600">
              Li e concordo com os Termos de Uso e com o Aviso de Privacidade do Worko.
            </span>
          </label>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <motion.button
          disabled={!isComplete || isSubmitting}
          whileHover={isComplete && !isSubmitting ? { scale: 1.02 } : {}}
          whileTap={isComplete && !isSubmitting ? { scale: 0.98 } : {}}
          className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 font-medium transition-all ${
            isComplete && !isSubmitting
              ? "bg-blue-600 text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.28)] hover:bg-blue-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          <span className="relative z-10 text-base font-semibold">
            {isSubmitting ? "Validando..." : "Validar e continuar"}
          </span>
          {isComplete && !isSubmitting ? (
            <>
              <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          ) : null}
        </motion.button>
      </form>
    </motion.div>
  );
}

