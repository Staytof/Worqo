import { useState } from "react";
import { AlertTriangle, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import { useApp } from "../context/AppContext";

export function DeviceVerification() {
  const navigate = useNavigate();
  const {
    state: { pendingDeviceVerification },
    verifyDeviceLogin,
    cancelDeviceVerification,
  } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!pendingDeviceVerification) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const result = await verifyDeviceLogin(code);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "Código inválido.");
      return;
    }

    navigate(result.user?.isAdmin ? "/admin" : "/app", { replace: true });
  };

  const handleUnknownAttempt = () => {
    const recoveryEmail = pendingDeviceVerification.email;
    cancelDeviceVerification();
    navigate(`/forgot-password?email=${encodeURIComponent(recoveryEmail)}`, { replace: true });
  };

  return (
    <div className="relative z-10 w-full max-w-md rounded-[30px] border border-white bg-white p-6 shadow-xl sm:p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">Confirme este aparelho</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Este celular ainda não foi confirmado para esta conta. Enviamos um código para{" "}
        <strong>{pendingDeviceVerification.maskedEmail}</strong>.
      </p>

      <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-blue-600" /> {pendingDeviceVerification.deviceLabel}</p>
        <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600" /> Código válido por 10 minutos</p>
      </div>

      {pendingDeviceVerification.debugCode ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Código de desenvolvimento: {pendingDeviceVerification.debugCode}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <form className="mt-6" onSubmit={handleSubmit}>
        <label className="text-sm font-semibold text-slate-700">Código de 6 dígitos</label>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-2xl font-bold tracking-[0.35em] outline-none focus:border-blue-500"
          required
        />
        <button
          type="submit"
          disabled={isSubmitting || code.length !== 6}
          className="mt-4 h-12 w-full rounded-2xl bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isSubmitting ? "Confirmando..." : "Confirmar e entrar"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleUnknownAttempt}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
      >
        <AlertTriangle className="h-4 w-4" /> Não fui eu: redefinir senha
      </button>
    </div>
  );
}
