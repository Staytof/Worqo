import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router";
import { Capacitor } from "@capacitor/core";
import logoImg from "@/assets/logosup.png";
import { resolveApiBaseUrl } from "../api/client";
import { useApp } from "../context/AppContext";

export function Login() {
  const navigate = useNavigate();
  const {
    state: { pendingVerification, rememberSession },
    completeGoogleLogin,
    login,
  } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => rememberSession);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"error" | "info">("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get("googleToken");
    const googleError = params.get("googleError");

    if (!googleToken && !googleError) {
      return;
    }

    window.history.replaceState(null, "", window.location.pathname || "/");

    if (googleError) {
      setFeedbackTone("error");
      setFeedback(googleError);
      return;
    }

    if (!googleToken) {
      return;
    }

    setIsGoogleSubmitting(true);

    void completeGoogleLogin({
      token: googleToken,
      rememberMe: params.get("googleRemember") !== "0",
    }).then((result) => {
      setIsGoogleSubmitting(false);

      if (!result.ok) {
        setFeedbackTone("error");
        setFeedback(result.error ?? "Não conseguimos concluir o login com Google.");
        return;
      }

      setFeedback("");
      navigate(result.user?.isAdmin ? "/admin" : "/app");
    });
  }, [completeGoogleLogin, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    setEmail(normalizedEmail);
    setPassword(normalizedPassword);

    const result = await login({
      email: normalizedEmail,
      password: normalizedPassword,
      rememberMe,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setFeedbackTone("error");
      setFeedback(result.error ?? "Não conseguimos entrar agora. Tente novamente.");
      return;
    }

    setFeedback("");
    navigate(result.user?.isAdmin ? "/admin" : "/app");
  };

  const handleRecovery = () => {
    setFeedbackTone("info");
    setFeedback(
      "Para recuperar o acesso, conclua a validação do cadastro e fale com o suporte pelo canal oficial."
    );
  };

  const handleGoogleLogin = () => {
    setFeedback("");
    setIsGoogleSubmitting(true);
    const baseUrl = resolveApiBaseUrl();
    const params = new URLSearchParams({
      rememberMe: rememberMe ? "true" : "false",
    });

    if (Capacitor.isNativePlatform()) {
      params.set("returnTo", "com.worqo.app://auth/google");
    }

    window.location.assign(`${baseUrl}/api/auth/google/start?${params.toString()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="login-screen-surface relative z-10 flex min-h-screen w-full bg-white"
    >
      <div
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10 sm:px-8"
        style={{
          paddingTop: "calc(40px + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.35 }}
          className="mb-8 flex flex-col items-center"
        >
          <img
            src={logoImg}
            alt="Worko"
            className="h-auto w-[190px] object-contain sm:w-[220px]"
          />
        </motion.div>

        <form className="w-full space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="ml-1 text-sm font-medium text-slate-700">E-mail</label>
            <div
              className={`relative flex w-full items-center rounded-[26px] border bg-slate-50 px-4 py-3.5 transition-all duration-300 ${
                emailFocus
                  ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Mail
                className={`h-5 w-5 flex-shrink-0 transition-colors ${
                  emailFocus ? "text-blue-500" : "text-slate-400"
                }`}
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
                className="ml-3 w-full border-none bg-transparent text-slate-700 outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="ml-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-slate-700">Senha</label>
              <button
                type="button"
                onClick={handleRecovery}
                className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
              >
                Precisa de ajuda para entrar?
              </button>
            </div>
            <div
              className={`relative flex w-full items-center rounded-[26px] border bg-slate-50 px-4 py-3.5 transition-all duration-300 ${
                passwordFocus
                  ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Lock
                className={`h-5 w-5 flex-shrink-0 transition-colors ${
                  passwordFocus ? "text-blue-500" : "text-slate-400"
                }`}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                className="mx-3 w-full border-none bg-transparent text-slate-700 outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-700">Manter-me conectado</span>
          </label>

          {feedback ? (
            <div
              className={`rounded-[24px] border px-4 py-3 text-sm ${
                feedbackTone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              }`}
            >
              {feedback}
            </div>
          ) : null}

          <motion.button
            whileHover={isSubmitting ? {} : { scale: 1.01 }}
            whileTap={isSubmitting ? {} : { scale: 0.99 }}
            disabled={isSubmitting}
            className={`group relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-[28px] py-4 font-medium text-white transition-all shadow-[0_14px_40px_rgba(37,99,235,0.28)] ${
              isSubmitting
                ? "cursor-not-allowed bg-slate-300"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <span className="relative z-10 text-base font-semibold">
              {isSubmitting ? "Entrando..." : "Acessar conta"}
            </span>
            {!isSubmitting ? (
              <>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            ) : null}
          </motion.button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || isGoogleSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-[28px] border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v2.98h3.88c2.27-2.09 3.54-5.17 3.54-8.85z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.88l-3.88-2.98c-1.08.72-2.45 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.95H1.26v3.07A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.33A7.2 7.2 0 0 1 4.9 12c0-.81.13-1.59.37-2.33V6.6H1.26A12 12 0 0 0 0 12c0 1.93.46 3.75 1.26 5.4l4.01-3.07z"
              />
              <path
                fill="#EA4335"
                d="M12 4.72c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.57 11.57 0 0 0 12 0 12 12 0 0 0 1.26 6.6l4.01 3.07C6.22 6.83 8.87 4.72 12 4.72z"
              />
            </svg>
            {isGoogleSubmitting ? "Conectando..." : "Entrar com Google"}
          </button>
        </form>

        {pendingVerification ? (
          <div className="mt-6 rounded-[24px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Cadastro pendente para <strong className="break-all">{pendingVerification.email}</strong>.
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm text-slate-500">
          Ainda não tem conta?{" "}
          <Link
            to="/register"
            className="font-semibold text-blue-600 transition-all hover:text-blue-700 hover:underline underline-offset-2"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
