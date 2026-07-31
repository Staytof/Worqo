import { useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { apiRequest } from "../api/client";
import { useApp } from "../context/AppContext";

type RecoveryResponse = {
  ok: boolean;
  message: string;
  debugCode?: string | null;
};

export function ForgotPassword() {
  const navigate = useNavigate();
  const { logout } = useApp();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email")?.trim() ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiRequest<RecoveryResponse>("/api/auth/password/forgot", {
        method: "POST",
        body: { email: normalizedEmail },
      });
      setStep("reset");
      setFeedback(
        response.debugCode
          ? `${response.message} Código de desenvolvimento: ${response.debugCode}`
          : response.message
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não conseguimos iniciar a recuperação agora."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await requestCode();
  };

  const handleResetSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest<RecoveryResponse>("/api/auth/password/reset", {
        method: "POST",
        body: {
          email: email.trim().toLowerCase(),
          code,
          newPassword,
        },
      });
      await logout();
      setFeedback(response.message);
      setStep("done");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não conseguimos redefinir sua senha."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-md rounded-[30px] border border-white bg-white p-6 shadow-xl sm:p-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao login
      </Link>

      {step === "done" ? (
        <div className="py-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Senha redefinida</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{feedback}</p>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="mt-7 h-12 w-full rounded-2xl bg-blue-600 font-semibold text-white hover:bg-blue-700"
          >
            Entrar com a nova senha
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Esqueci minha senha</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {step === "email"
              ? "Informe o e-mail da conta para receber um código de recuperação."
              : "Digite o código enviado por e-mail e escolha sua nova senha."}
          </p>

          {feedback ? (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm leading-relaxed text-blue-800">
              {feedback}
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {step === "email" ? (
            <form className="mt-6 space-y-4" onSubmit={handleEmailSubmit}>
              <label className="block text-sm font-semibold text-slate-700">E-mail</label>
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Mail className="h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="ml-3 min-w-0 flex-1 bg-transparent text-slate-800 outline-none"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full rounded-2xl bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isSubmitting ? "Enviando..." : "Enviar código por e-mail"}
              </button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleResetSubmit}>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Código de 6 dígitos</label>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-xl font-bold tracking-[0.35em] outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Nova senha</label>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    className="h-12 min-w-0 flex-1 bg-transparent outline-none"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((current) => !current)}>
                    {showPassword ? <EyeOff className="h-5 w-5 text-slate-400" /> : <Eye className="h-5 w-5 text-slate-400" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700">Confirmar nova senha</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || code.length !== 6}
                className="h-12 w-full rounded-2xl bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isSubmitting ? "Redefinindo..." : "Redefinir senha"}
              </button>
              <button
                type="button"
                onClick={() => void requestCode()}
                disabled={isSubmitting}
                className="w-full text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Reenviar código
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
