import { CheckCircle2, Clock3, LoaderCircle, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import logoImg from "@/assets/logosup.png";
import { useApp } from "../context/AppContext";

export function ProviderReviewStatus() {
  const {
    state: { authReady, isAuthenticated, onboardingStep, user },
    refreshSessionState,
    logout,
  } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || onboardingStep !== "provider-review") return;
    const timer = window.setInterval(() => void refreshSessionState(), 30_000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, onboardingStep, refreshSessionState, user]);

  if (authReady && (!isAuthenticated || !user)) return <Navigate to="/" replace />;
  if (authReady && onboardingStep === "provider-verification") return <Navigate to="/provider-verification" replace />;
  if (authReady && onboardingStep === "app") return <Navigate to={user?.isAdmin ? "/admin" : "/app"} replace />;

  const rejected = user?.providerVerificationStatus === "rejected";

  async function handleRefresh() {
    setIsRefreshing(true);
    await refreshSessionState();
    setIsRefreshing(false);
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-md rounded-[32px] bg-white p-6 text-center shadow-xl sm:p-9">
      <div className="mb-8 flex items-center justify-between">
        <img src={logoImg} alt="Worko" className="h-9 w-auto" />
        <button type="button" onClick={() => void logout()} className="text-sm font-semibold text-slate-500">Sair</button>
      </div>

      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${rejected ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
        {rejected ? <ShieldX className="h-10 w-10" /> : <Clock3 className="h-10 w-10" />}
      </div>
      <h1 className="mt-6 text-2xl font-black text-slate-950">{rejected ? "Cadastro não aprovado" : "Documentos em análise"}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {rejected
          ? "Após a análise cadastral, não foi possível liberar seu acesso como prestador(a)."
          : "Recebemos seus documentos. A equipe Worko fará a verificação em até 1 dia útil e avisará você por e-mail."}
      </p>

      {rejected && user?.providerVerificationDecisionNote ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-left text-sm text-red-900">
          <strong>Mensagem da equipe:</strong><p className="mt-1">{user.providerVerificationDecisionNote}</p>
        </div>
      ) : null}

      {!rejected ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-left text-xs leading-5 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          Você não precisa manter esta tela aberta. Quando voltar ao app, o status também será atualizado automaticamente.
        </div>
      ) : null}

      <button type="button" disabled={isRefreshing} onClick={() => void handleRefresh()} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 font-bold text-white disabled:opacity-60">
        {isRefreshing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
        Atualizar situação
      </button>
    </main>
  );
}
