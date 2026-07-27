import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Clock3,
  HelpCircle,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
  Wallet as WalletIcon,
} from "lucide-react";
import { Link } from "react-router";
import { apiRequest } from "../api/client";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import type { WorkerWalletSummary, WorkerWithdrawalRecord } from "../types";
import { formatCurrencyAmount, INSTANT_WITHDRAWAL_FEE_AMOUNT } from "../utils/helpers";
import { ProfileSectionLayout } from "./profile/ProfileSectionLayout";

function getWithdrawalStatusLabel(withdrawal: WorkerWithdrawalRecord) {
  if (withdrawal.status === "DONE") {
    return "Concluído";
  }

  if (withdrawal.status === "PENDING") {
    return "Pendente";
  }

  if (withdrawal.status === "BANK_PROCESSING") {
    return "Processando no banco";
  }

  if (withdrawal.status === "FAILED") {
    return "Falhou";
  }

  if (withdrawal.status === "CANCELLED") {
    return "Cancelado";
  }

  return withdrawal.status;
}

const emptyWallet: WorkerWalletSummary = {
  hasPixKeyConfigured: false,
  canReceivePixTransfers: false,
  pixKeyMatchesCpf: false,
  pixKeyType: null,
  pixKey: "",
  awaitingClientPaymentCents: 0,
  heldForServiceCents: 0,
  availableToWithdrawCents: 0,
  availableForStandardWithdrawalCents: 0,
  instantWithdrawalFeeCents: Math.round(INSTANT_WITHDRAWAL_FEE_AMOUNT * 100),
  providerAvailableBalanceCents: null,
  instantAvailableNowCents: 0,
  standardAvailableNowCents: 0,
  providerBalanceShortfallCents: 0,
  providerBalanceMessage: null,
  providerBalanceSyncedAt: null,
  processingWithdrawalsCents: 0,
  recentEntries: [],
  recentWithdrawals: [],
};

function formatWalletDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type WalletBalancePanel = "awaiting" | "available" | "protected" | "processing";
type WithdrawalMode = "instant" | "standard";

const walletBalancePanelContent: Record<
  WalletBalancePanel,
  { title: string; tone: string; label: string }
> = {
  awaiting: {
    title: "Aguardando",
    label: "Aguardando",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
  },
  available: {
    title: "Disponível",
    label: "Disponível",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  protected: {
    title: "Protegido",
    label: "Protegido",
    tone: "border-blue-200 bg-blue-50 text-blue-700",
  },
  processing: {
    title: "Sacando",
    label: "Sacando",
    tone: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

export function Wallet() {
  const {
    state: { sessionToken, user },
    refreshSessionState,
  } = useApp();
  const [wallet, setWallet] = useState<WorkerWalletSummary>(emptyWallet);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWithdrawingMode, setIsWithdrawingMode] = useState<WithdrawalMode | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openBalancePanel, setOpenBalancePanel] = useState<WalletBalancePanel | null>(null);
  const [isPixHelpOpen, setIsPixHelpOpen] = useState(false);
  useErrorToast(error);

  const walletReady = Boolean(wallet.canReceivePixTransfers || user?.canReceivePixTransfers);
  const currentBalanceCents =
    wallet.availableToWithdrawCents +
    wallet.heldForServiceCents +
    wallet.processingWithdrawalsCents;
  const availableForInstantCents = wallet.instantAvailableNowCents;
  const availableForStandardCents = wallet.standardAvailableNowCents;
  const instantFeeCents = wallet.instantWithdrawalFeeCents;
  const hasEnoughForInstantWithdrawal = availableForInstantCents > instantFeeCents;
  const instantNetPayoutCents = Math.max(availableForInstantCents - instantFeeCents, 0);

  const balanceCards: Array<{
    id: WalletBalancePanel;
    amountCents: number;
  }> = [
    {
      id: "awaiting",
      amountCents: wallet.awaitingClientPaymentCents,
    },
    {
      id: "protected",
      amountCents: wallet.heldForServiceCents,
    },
    {
      id: "available",
      amountCents: wallet.availableToWithdrawCents,
    },
    {
      id: "processing",
      amountCents: wallet.processingWithdrawalsCents,
    },
  ];

  const loadWallet = async (mode: "initial" | "refresh" = "initial") => {
    if (!sessionToken) {
      setIsLoading(false);
      setError("Não encontramos sua sessão para carregar a carteira.");
      return;
    }

    if (mode === "refresh") {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const walletResponse = await apiRequest<{ wallet: WorkerWalletSummary }>("/api/me/wallet", {
        token: sessionToken,
      });

      setWallet(walletResponse.wallet);
      setError("");
      void refreshSessionState().catch(() => undefined);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não conseguimos carregar sua carteira agora."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadWallet();
  }, [sessionToken]);

  const handleWithdraw = async (mode: WithdrawalMode) => {
    if (!sessionToken || isWithdrawingMode) {
      return;
    }

    setIsWithdrawingMode(mode);
    setError("");
    setMessage("");

    try {
      const response = await apiRequest<{ withdrawal?: WorkerWithdrawalRecord }>(
        "/api/me/wallet/withdraw",
        {
          method: "POST",
          token: sessionToken,
          body: { mode },
        }
      );

      await loadWallet("refresh");

      if (response.withdrawal?.mode === "instant") {
        setMessage(
          `Saque imediato solicitado para ${response.withdrawal.pixKeyMasked}. Taxa aplicada: ${formatCurrencyAmount(
            response.withdrawal.feeAmountCents / 100
          )}.`
        );
      } else {
        setMessage(
          response.withdrawal
            ? `Saque grátis solicitado para ${response.withdrawal.pixKeyMasked}.`
            : "Saque Pix solicitado com sucesso."
        );
      }
    } catch (withdrawError) {
      setError(
        withdrawError instanceof Error
          ? withdrawError.message
          : "Não conseguimos solicitar o saque Pix agora."
      );
    } finally {
      setIsWithdrawingMode(null);
    }
  };

  return (
    <ProfileSectionLayout>
      <div className="space-y-0">
        <section className="worqo-section">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
              Saldo
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {isLoading ? "Carregando..." : formatCurrencyAmount(currentBalanceCents / 100)}
            </p>
            <div className="mt-4 worqo-flat-panel px-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Saque imediato
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {formatCurrencyAmount(instantNetPayoutCents / 100)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Saque grátis
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">
                    {formatCurrencyAmount(availableForStandardCents / 100)}
                  </p>
                </div>
              </div>

            </div>

            <div className="mt-5 worqo-flat-panel px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Chave Pix CPF cadastrada
                  </p>
                  <p className="mt-2 min-w-0 break-all text-base font-semibold text-slate-900">
                    {wallet.pixKeyType && wallet.pixKey
                      ? `${wallet.pixKeyType}: ${wallet.pixKey}`
                      : "Chave Pix pendente"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPixHelpOpen((current) => !current)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                  aria-label="Ajuda sobre a chave Pix CPF"
                  aria-expanded={isPixHelpOpen}
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>

              {wallet.hasPixKeyConfigured ? (
                wallet.pixKeyMatchesCpf ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                    Chave conferida.
                  </div>
                ) : (
                  <div className="mt-3 worqo-flat-panel worqo-flat-panel--amber px-4 py-3 text-sm text-amber-900">
                    Chave Pix divergente.
                  </div>
                )
              ) : (
                <p className="mt-3 text-sm text-slate-500">Saques bloqueados.</p>
              )}

              <AnimatePresence initial={false}>
                {isPixHelpOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-4 worqo-flat-panel worqo-flat-panel--amber px-4 py-4 text-sm text-amber-900"
                  >
                    <div className="flex items-start gap-3">
                      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                      <p className="leading-relaxed">CPF validado no perfil.</p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-5 flex min-w-0 flex-col gap-3">
            {walletReady ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleWithdraw("instant")}
                  disabled={
                    isWithdrawingMode !== null ||
                    !walletReady ||
                    !hasEnoughForInstantWithdrawal
                  }
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  {isWithdrawingMode === "instant"
                    ? "Solicitando saque..."
                    : `Saque imediato (${formatCurrencyAmount(instantFeeCents / 100)})`}
                </button>

                <button
                  type="button"
                  onClick={() => void handleWithdraw("standard")}
                  disabled={
                    isWithdrawingMode !== null ||
                    !walletReady ||
                    availableForStandardCents <= 0
                  }
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Clock3 className="h-4 w-4" />
                  {isWithdrawingMode === "standard"
                    ? "Solicitando saque..."
                    : "Saque grátis após 24h"}
                </button>
              </div>
            ) : (
              <Link
                to="/app/profile/data"
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <WalletIcon className="h-4 w-4" />
                Ajustar chave Pix CPF
              </Link>
            )}

            <p className="text-xs leading-relaxed text-slate-500">
              O saque grátis fica disponível 24 horas depois que o valor cair na carteira.
            </p>

            <button
              type="button"
              onClick={() => void loadWallet("refresh")}
              disabled={isRefreshing || isLoading}
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Atualizando..." : "Atualizar carteira"}
            </button>
          </div>

          {message ? (
            <div className="mt-4 worqo-flat-panel worqo-flat-panel--emerald px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 worqo-flat-panel worqo-flat-panel--rose px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="worqo-section">
          <div className="grid grid-cols-2 gap-3">
            {balanceCards.map(({ amountCents, id }) => {
              const panel = walletBalancePanelContent[id];
              const isOpen = openBalancePanel === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setOpenBalancePanel((current) => (current === id ? null : id))
                  }
                  aria-expanded={isOpen}
                  className={`worqo-flat-panel min-w-0 px-3.5 py-3.5 text-left transition ${
                    isOpen ? panel.tone : "border-blue-100 bg-white text-slate-700"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-90">
                    {panel.label}
                  </p>
                  <p className="mt-2 text-base font-bold leading-tight text-slate-900 sm:text-xl">
                    {formatCurrencyAmount(amountCents / 100)}
                  </p>
                </button>
              );
            })}
          </div>

          <AnimatePresence initial={false}>
            {openBalancePanel ? (
              <motion.div
                key={openBalancePanel}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="mt-4 worqo-flat-panel worqo-flat-panel--blue px-4 py-3 text-sm font-semibold text-slate-900"
              >
                {walletBalancePanelContent[openBalancePanel].title}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        <section className="worqo-section">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
              Histórico de saques
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Saques Pix realizados</h2>
          </div>

          {isLoading ? (
            <div className="mt-5 worqo-flat-panel px-4 py-8 text-center text-sm text-slate-500">
              Carregando saques...
            </div>
          ) : wallet.recentWithdrawals.length > 0 ? (
            <div className="mt-5 worqo-divider-list">
              {wallet.recentWithdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="worqo-list-row min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrencyAmount(withdrawal.amountCents / 100)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Status: {getWithdrawalStatusLabel(withdrawal)}
                      </p>
                    </div>
                    <span className="rounded-full border border-blue-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {withdrawal.mode === "instant" ? "Imediato" : "Grátis após 24h"}
                    </span>
                  </div>

                  <p className="mt-3 break-all text-xs text-slate-500">
                    Destino: {withdrawal.pixKeyMasked}
                  </p>
                  {withdrawal.feeAmountCents > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Taxa aplicada: {formatCurrencyAmount(withdrawal.feeAmountCents / 100)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Criado em: {formatWalletDate(withdrawal.createdAt) || "Não informado"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 worqo-flat-panel px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700">Nenhum saque no histórico</p>
            </div>
          )}
        </section>
      </div>
    </ProfileSectionLayout>
  );
}

