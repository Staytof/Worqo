import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeDollarSign,
  Download,
  FileCheck2,
  Headset,
  LayoutDashboard,
  LogOut,
  MapPinned,
  MessageSquareText,
  RefreshCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Navigate } from "react-router";
import { apiRequest } from "../api/client";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import { loadGoogleMapsApi, resolveGoogleMapsMapId } from "../lib/googleMaps";
import {
  SERVICE_AREA_CENTER,
  SERVICE_AREA_HOLE_PATHS,
  SERVICE_AREA_MIN_ZOOM,
  SERVICE_AREA_PATHS,
  getBoundsFromPaths,
  isWithinServiceArea,
  mergeBounds,
  type MapBoundsLiteral,
} from "../lib/serviceArea";
import type {
  AdminDashboard,
  AdminHealthSnapshot,
  AdminMonitoredChat,
  AdminProviderVerificationRecord,
  AdminServiceRequestRecord,
  AdminUserRecord,
} from "../types";
import { formatCurrencyAmount, getInitials } from "../utils/helpers";
import { AdminSupportDesk } from "./admin/AdminSupportDesk";
import { BrandSplash } from "./BrandSplash";

type AdminSection = "overview" | "map" | "verification" | "users" | "requests" | "chats" | "wallet" | "system" | "support";
type RequestTab = "all" | "map" | "live" | "disputes";
type UserTab = "all" | "new" | "verified" | "pending";
type VerificationTab = "review" | "waiting" | "approved" | "rejected" | "all";

const LIVE_REQUEST_STATUSES = new Set([
  "searching",
  "assigned",
  "chatting",
  "details",
  "waiting-worker",
  "payment",
  "confirmed",
]);

const MAP_REQUEST_STATUSES = new Set(["searching", "assigned"]);
const PENDING_WITHDRAWAL_STATUSES = new Set([
  "PENDING",
  "BANK_PROCESSING",
  "AWAITING_AUTORIZATION",
  "AWAITING_AUTHORIZATION",
]);

const adminSections: Array<{ id: AdminSection; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Resumo", icon: LayoutDashboard },
  { id: "map", label: "Mapa", icon: MapPinned },
  { id: "verification", label: "Verificações", icon: FileCheck2 },
  { id: "users", label: "Usuários(as)", icon: Users },
  { id: "requests", label: "Pedidos", icon: Smartphone },
  { id: "chats", label: "Chats ativos", icon: MessageSquareText },
  { id: "wallet", label: "Carteira", icon: Wallet },
  { id: "system", label: "Sistema", icon: ServerCog },
  { id: "support", label: "SAC", icon: Headset },
];

function formatDate(value: string | null, compact = false) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(
    "pt-BR",
    compact
      ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
  ).format(new Date(value));
}

function isWithinDays(value: string | null, days: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && Date.now() - time <= days * 86400000;
}

function since(value: string | null) {
  if (!value) return "sem data";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "sem data";
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 2) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function badge(kind: "blue" | "emerald" | "amber" | "rose" | "slate") {
  return {
    blue: "border-blue-500/40 bg-blue-500/12 text-blue-100",
    emerald: "border-emerald-500/40 bg-emerald-500/12 text-emerald-100",
    amber: "border-amber-500/40 bg-amber-500/12 text-amber-100",
    rose: "border-rose-500/40 bg-rose-500/12 text-rose-100",
    slate: "border-slate-700 bg-slate-900 text-slate-200",
  }[kind];
}

function requestBadge(status: string) {
  if (status === "searching") return badge("blue");
  if (status === "confirmed" || status === "completed") return badge("emerald");
  if (status === "payment" || status === "waiting-worker") return badge("amber");
  if (status === "cancelled") return badge("rose");
  return badge("slate");
}

export function AdminPanel() {
  const {
    logout,
    state: { authReady, sessionToken, user },
  } = useApp();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [health, setHealth] = useState<AdminHealthSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [requestTab, setRequestTab] = useState<RequestTab>("all");
  const [userTab, setUserTab] = useState<UserTab>("all");
  const [userSearch, setUserSearch] = useState("");
  const [verificationTab, setVerificationTab] = useState<VerificationTab>("review");
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({});
  const [updatingVerificationId, setUpdatingVerificationId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [userPendingDeletion, setUserPendingDeletion] = useState<AdminUserRecord | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  useErrorToast(error);

  const loadDashboard = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!sessionToken) return;
      mode === "refresh" ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const [nextDashboard, nextHealth] = await Promise.all([
          apiRequest<AdminDashboard>(
            activeSection === "verification"
              ? "/api/admin/dashboard?providerDocuments=1"
              : "/api/admin/dashboard",
            { token: sessionToken }
          ),
          apiRequest<AdminHealthSnapshot>("/api/health"),
        ]);
        setDashboard(nextDashboard);
        setHealth(nextHealth);
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Não conseguimos carregar o painel.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeSection, sessionToken]
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!sessionToken) return undefined;
    const interval = window.setInterval(() => void loadDashboard("refresh"), 15000);
    return () => window.clearInterval(interval);
  }, [loadDashboard, sessionToken]);

  const mapRequests = useMemo(
    () =>
      (dashboard?.requests ?? []).filter(
        (request) =>
          LIVE_REQUEST_STATUSES.has(request.status) &&
          Number.isFinite(request.latitude) &&
          Number.isFinite(request.longitude) &&
          isWithinServiceArea({ lat: request.latitude, lng: request.longitude })
      ),
    [dashboard?.requests]
  );

  const filteredRequests = useMemo(() => {
    const requests = dashboard?.requests ?? [];
    if (requestTab === "map") return requests.filter((request) => MAP_REQUEST_STATUSES.has(request.status));
    if (requestTab === "live") return requests.filter((request) => LIVE_REQUEST_STATUSES.has(request.status));
    if (requestTab === "disputes") return requests.filter((request) => request.dispute?.status === "open");
    return requests;
  }, [dashboard?.requests, requestTab]);

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    return (dashboard?.users ?? []).filter((entry) => {
      if (userTab === "new" && !isWithinDays(entry.createdAt, 7)) return false;
      if (userTab === "verified" && !entry.cpfVerifiedAt) return false;
      if (userTab === "pending" && entry.cpfVerifiedAt && entry.emailVerifiedAt && entry.profileCompletedAt) return false;
      if (!search) return true;
      return (
        entry.fullName.toLowerCase().includes(search) ||
        entry.email.toLowerCase().includes(search) ||
        entry.phone.toLowerCase().includes(search)
      );
    });
  }, [dashboard?.users, userSearch, userTab]);

  const filteredProviderVerifications = useMemo(() => {
    return (dashboard?.providerVerifications ?? []).filter((entry) => {
      if (verificationTab === "review") return entry.status === "under_review";
      if (verificationTab === "waiting") {
        return entry.status === "pending_documents" || entry.status === "changes_requested";
      }
      if (verificationTab === "approved") return entry.status === "approved";
      if (verificationTab === "rejected") return entry.status === "rejected";
      return true;
    });
  }, [dashboard?.providerVerifications, verificationTab]);

  const handleResolveDispute = async (request: AdminServiceRequestRecord, action: "continue" | "refund") => {
    if (!sessionToken || resolvingId) return;
    setResolvingId(request.id);
    setError("");
    try {
      await apiRequest(`/api/admin/service-requests/${request.id}/resolve-dispute`, {
        method: "PATCH",
        token: sessionToken,
        body: { action, adminNote: resolutionNote[request.id] ?? "" },
      });
      await loadDashboard("refresh");
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Não conseguimos resolver a disputa agora.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleAdminUserAction = async (
    targetUserId: string,
    action: "flag" | "clear-flag" | "suspend" | "reinstate",
    reason: string
  ) => {
    if (!sessionToken || updatingUserId) return;
    setUpdatingUserId(targetUserId);
    setError("");
    try {
      await apiRequest(`/api/admin/users/${targetUserId}/state`, {
        method: "PATCH",
        token: sessionToken,
        body: { action, reason },
      });
      await loadDashboard("refresh");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Não conseguimos atualizar este usuário agora.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!sessionToken || !userPendingDeletion || updatingUserId) return;

    const target = userPendingDeletion;
    setUpdatingUserId(target.id);
    setError("");

    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(target.id)}`, {
        method: "DELETE",
        token: sessionToken,
      });
      setUserPendingDeletion(null);
      await loadDashboard("refresh");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não conseguimos excluir este usuário agora."
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleProviderVerification = async (
    providerUserId: string,
    action: "approve" | "request-documents" | "reject"
  ) => {
    if (!sessionToken || updatingVerificationId) return;
    setUpdatingVerificationId(providerUserId);
    setError("");

    try {
      await apiRequest(`/api/admin/provider-verifications/${providerUserId}`, {
        method: "PATCH",
        token: sessionToken,
        body: {
          action,
          reason: verificationNotes[providerUserId] ?? "",
        },
      });
      setVerificationNotes((current) => ({ ...current, [providerUserId]: "" }));
      await loadDashboard("refresh");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Não conseguimos concluir a verificação deste prestador."
      );
    } finally {
      setUpdatingVerificationId(null);
    }
  };

  const exportCsv = (fileName: string, rows: string[][]) => {
    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
  };

  if (!authReady) return <BrandSplash />;
  if (!user) return <Navigate to="/" replace />;
  if (!user.isAdmin) return <Navigate to="/app/profile" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">Worko Admin</p>
              <h1 className="mt-1 text-2xl font-bold text-white">Painel administrativo</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDashboard("refresh")}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-2 text-sm font-semibold text-blue-50 transition hover:bg-blue-500/25 disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Atualizando" : "Atualizar"}
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-500/25 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Saindo" : "Sair"}
              </button>
            </div>
          </div>
          <nav className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-8">
            {adminSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  activeSection === section.id
                    ? "border-blue-400/50 bg-blue-500/20 text-white"
                    : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </button>
            ))}
          </nav>
        </header>

        {error ? <div className="rounded-xl border border-rose-500/40 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        {activeSection === "overview" ? (
          <OverviewSection dashboard={dashboard} health={health} isLoading={isLoading} />
        ) : null}

        {activeSection === "map" ? (
          <AdminLiveMap requests={mapRequests} updatedAt={health?.time ?? null} isLoading={isLoading} />
        ) : null}

        {activeSection === "verification" ? (
          <ProviderVerificationSection
            providers={filteredProviderVerifications}
            allProviders={dashboard?.providerVerifications ?? []}
            tab={verificationTab}
            isLoading={isLoading}
            updatingId={updatingVerificationId}
            notes={verificationNotes}
            onTabChange={setVerificationTab}
            onNoteChange={(providerId, value) =>
              setVerificationNotes((current) => ({
                ...current,
                [providerId]: value.slice(0, 500),
              }))
            }
            onAction={(providerId, action) =>
              void handleProviderVerification(providerId, action)
            }
          />
        ) : null}

        {activeSection === "users" ? (
          <UsersSection
            users={filteredUsers}
            isLoading={isLoading}
            userTab={userTab}
            userSearch={userSearch}
            updatingUserId={updatingUserId}
            onUserTabChange={setUserTab}
            onSearchChange={setUserSearch}
            onAdminAction={handleAdminUserAction}
            onDeleteUser={setUserPendingDeletion}
            onExport={() =>
              exportCsv("worko-usuarios.csv", [
                ["Nome", "E-mail", "Telefone", "Criado em", "E-mail verificado", "CPF verificado", "Perfil completo", "Suspenso", "Sinalizado"],
                ...(dashboard?.users ?? []).map((entry) => [
                  entry.fullName,
                  entry.email,
                  entry.phone,
                  entry.createdAt,
                  entry.emailVerifiedAt ? "sim" : "não",
                  entry.cpfVerifiedAt ? "sim" : "não",
                  entry.profileCompletedAt ? "sim" : "não",
                  entry.isSuspended ? "sim" : "não",
                  entry.isFlagged ? "sim" : "não",
                ]),
              ])
            }
          />
        ) : null}

        {userPendingDeletion ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-950 p-5 shadow-2xl shadow-black/50">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                <Trash2 className="h-5 w-5" />
              </div>
              <h2 id="delete-user-title" className="mt-4 text-xl font-bold text-white">
                Excluir usuário(a)?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                A conta de <strong className="text-white">{userPendingDeletion.fullName}</strong> será
                encerrada, os dados pessoais serão removidos, todas as sessões serão revogadas e o e-mail
                <strong className="text-white"> {userPendingDeletion.email}</strong> ficará bloqueado
                permanentemente para novos cadastros.
              </p>
              <p className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                Registros financeiros e operacionais obrigatórios permanecem anonimizados. A exclusão não é
                permitida enquanto houver saldo ou saque pendente.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={updatingUserId === userPendingDeletion.id}
                  onClick={() => setUserPendingDeletion(null)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={updatingUserId === userPendingDeletion.id}
                  onClick={() => void handleDeleteUser()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {updatingUserId === userPendingDeletion.id ? "Excluindo..." : "Excluir conta"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "requests" ? (
          <RequestsSection
            requests={filteredRequests}
            statusCounts={dashboard?.requestStatusCounts ?? []}
            isLoading={isLoading}
            requestTab={requestTab}
            resolutionNote={resolutionNote}
            resolvingId={resolvingId}
            onRequestTabChange={setRequestTab}
            onChangeNote={(requestId, value) =>
              setResolutionNote((current) => ({ ...current, [requestId]: value.slice(0, 400) }))
            }
            onResolve={(request, action) => void handleResolveDispute(request, action)}
            onExport={() =>
              exportCsv("worko-pedidos.csv", [
                ["Categoria", "Descrição", "Status", "Cliente", "Profissional", "Criado em", "Atualizado em", "Pagamento"],
                ...(dashboard?.requests ?? []).map((entry) => [
                  entry.category,
                  entry.description,
                  entry.status,
                  entry.requesterName,
                  entry.workerName ?? "",
                  entry.createdAt,
                  entry.updatedAt,
                  entry.paymentStatus ?? "",
                ]),
              ])
            }
          />
        ) : null}

        {activeSection === "chats" ? (
          <ActiveChatsSection chats={dashboard?.activeChats ?? []} />
        ) : null}

        {activeSection === "wallet" ? <WalletSection withdrawals={dashboard?.withdrawals ?? []} /> : null}

        {activeSection === "system" ? <SystemSection health={health} /> : null}

        {activeSection === "support" ? (
          <section>{sessionToken ? <AdminSupportDesk sessionToken={sessionToken} /> : null}</section>
        ) : null}
      </div>
    </div>
  );
}

function OverviewSection({
  dashboard,
  health,
  isLoading,
}: {
  dashboard: AdminDashboard | null;
  health: AdminHealthSnapshot | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <EmptyPanel text="Carregando painel..." />;
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Usuários(as)" value={dashboard?.overview.totalUsers ?? 0} icon={Users} tone="blue" />
        <MetricCard label="CPF verificado" value={dashboard?.overview.verifiedUsers ?? 0} icon={ShieldCheck} tone="emerald" />
        <MetricCard label="Análises pendentes" value={dashboard?.overview.pendingProviderVerifications ?? 0} icon={FileCheck2} tone="amber" />
        <MetricCard label="Mapa" value={dashboard?.overview.openMapRequests ?? 0} icon={MapPinned} tone="amber" />
        <MetricCard label="SAC" value={dashboard?.overview.supportOpenTickets ?? 0} icon={Headset} tone="rose" />
        <MetricCard label="Volume" value={formatCurrencyAmount((dashboard?.overview.grossVolumeCents ?? 0) / 100)} icon={BadgeDollarSign} tone="blue" />
        <MetricCard label="Receita" value={formatCurrencyAmount((dashboard?.overview.feeVolumeCents ?? 0) / 100)} icon={Wallet} tone="emerald" />
        <MetricCard label="Disputas" value={dashboard?.overview.openDisputes ?? 0} icon={AlertTriangle} tone="amber" />
        <MetricCard label="Ativos 24h" value={dashboard?.overview.activeUsers24h ?? 0} icon={Smartphone} tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <CompactPanel title="SAC">
          <StatGrid
            items={[
              ["Aguardando", dashboard?.supportOverview.waitingTickets ?? 0],
              ["Em atendimento", dashboard?.supportOverview.activeTickets ?? 0],
              ["Fechados", dashboard?.supportOverview.closedTickets ?? 0],
              ["última mensagem", formatDate(dashboard?.supportOverview.latestCustomerMessageAt ?? null, true)],
            ]}
          />
        </CompactPanel>

        <CompactPanel title="Pedidos">
          <StatGrid
            items={[
              ["Abertos", dashboard?.overview.openRequests ?? 0],
              ["Mapa", dashboard?.overview.openMapRequests ?? 0],
              ["Confirmados", dashboard?.overview.confirmedServices ?? 0],
              ["Saques pendentes", dashboard?.overview.pendingWithdrawals ?? 0],
            ]}
          />
        </CompactPanel>

        <CompactPanel title="Sistema">
          <StatGrid
            items={[
              ["Requests", health?.metrics.totalRequests ?? 0],
              ["Erros", health?.metrics.totalServerErrors ?? 0],
              ["Cliente", health?.metrics.clientReportsStored ?? 0],
              ["Uptime", `${health?.uptimeSeconds ?? 0}s`],
            ]}
          />
        </CompactPanel>
      </div>
    </section>
  );
}

function AdminLiveMap({
  requests,
  updatedAt,
  isLoading,
}: {
  requests: AdminServiceRequestRecord[];
  updatedAt: string | null;
  isLoading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const serviceAreaMaskRef = useRef<any>(null);
  const serviceAreaOutlineRefs = useRef<any[]>([]);
  const hasAppliedInitialRequestsViewportRef = useRef(false);
  const [mapError, setMapError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useErrorToast(mapError);

  const selectedRequest = requests.find((request) => request.id === selectedId) ?? requests[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      try {
        const maps = await loadGoogleMapsApi();

        if (cancelled || !containerRef.current) return;

        const serviceAreaBounds = getBoundsFromPaths(SERVICE_AREA_PATHS);

        mapsRef.current = maps;
        mapRef.current = new maps.Map(containerRef.current, {
          center: SERVICE_AREA_CENTER,
          zoom: SERVICE_AREA_MIN_ZOOM,
          clickableIcons: false,
          fullscreenControl: true,
          mapTypeControl: false,
          minZoom: SERVICE_AREA_MIN_ZOOM,
          restriction: {
            latLngBounds: serviceAreaBounds,
            strictBounds: true,
          },
          streetViewControl: false,
          gestureHandling: "greedy",
          mapId: resolveGoogleMapsMapId(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID),
        });
        mapRef.current.fitBounds(serviceAreaBounds, 24);
        syncAdminServiceAreaOverlays(maps, mapRef.current, serviceAreaBounds, serviceAreaMaskRef, serviceAreaOutlineRefs);
        mapRef.current.addListener("idle", () => {
          syncAdminServiceAreaOverlays(maps, mapRef.current, serviceAreaBounds, serviceAreaMaskRef, serviceAreaOutlineRefs);
        });
        setMapError("");
      } catch (error) {
        setMapError(error instanceof Error ? error.message : "Não foi possível carregar o mapa.");
      }
    }

    void initMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    markersRef.current.forEach((marker) => marker.setMap?.(null));
    markersRef.current = [];

    if (!requests.length) {
      return;
    }

    const bounds = new maps.LatLngBounds();

    requests.forEach((request) => {
      const position = { lat: request.latitude, lng: request.longitude };
      bounds.extend(position);
      const marker = new maps.Marker({
        map,
        position,
        title: `${request.agreementTitle || request.category} - ${request.requesterName}`,
      });
      marker.addListener("click", () => setSelectedId(request.id));
      markersRef.current.push(marker);
    });

    if (!hasAppliedInitialRequestsViewportRef.current) {
      if (requests.length === 1) {
        map.setCenter({ lat: requests[0].latitude, lng: requests[0].longitude });
        map.setZoom(15);
      } else {
        map.fitBounds(bounds, 72);
      }
      hasAppliedInitialRequestsViewportRef.current = true;
    }
  }, [requests]);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div ref={containerRef} className="h-[68vh] min-h-[520px] w-full bg-slate-900" />
        {mapError ? <div className="border-t border-slate-800 px-4 py-3 text-sm text-rose-200">{mapError}</div> : null}
      </div>

      <aside className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Mapa em tempo real</h2>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge("blue")}`}>
            {requests.length}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Atualizado {updatedAt ? formatDate(updatedAt, true) : "automaticamente"}</p>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <EmptyPanel text="Carregando mapa..." />
          ) : requests.length ? (
            requests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => setSelectedId(request.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedRequest?.id === request.id
                    ? "border-blue-400/50 bg-blue-500/15"
                    : "border-slate-800 bg-slate-900 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${requestBadge(request.status)}`}>
                    {request.status}
                  </span>
                  <span className="text-xs text-slate-500">{since(request.updatedAt)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">
                  {request.agreementTitle || request.description}
                </p>
                {request.agreementTitle ? (
                  <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                    {request.description}
                  </p>
                ) : null}
                <p className="mt-1 truncate text-xs text-slate-400">{request.requesterName}</p>
              </button>
            ))
          ) : (
            <EmptyPanel text="Nenhum pedido ativo no mapa." />
          )}
        </div>
      </aside>
    </section>
  );
}

function syncAdminServiceAreaOverlays(
  maps: any,
  map: any,
  serviceAreaBounds: MapBoundsLiteral,
  serviceAreaMaskRef: MutableRefObject<any>,
  serviceAreaOutlineRefs: MutableRefObject<any[]>
) {
  const viewportBounds = map.getBounds?.();

  if (viewportBounds) {
    const viewportLiteral: MapBoundsLiteral = {
      north: viewportBounds.getNorthEast().lat(),
      east: viewportBounds.getNorthEast().lng(),
      south: viewportBounds.getSouthWest().lat(),
      west: viewportBounds.getSouthWest().lng(),
    };
    const mergedBounds = mergeBounds(viewportLiteral, serviceAreaBounds);
    const padding = 0.02;
    const outerMaskPath = [
      { lat: mergedBounds.north + padding, lng: mergedBounds.west - padding },
      { lat: mergedBounds.north + padding, lng: mergedBounds.east + padding },
      { lat: mergedBounds.south - padding, lng: mergedBounds.east + padding },
      { lat: mergedBounds.south - padding, lng: mergedBounds.west - padding },
    ];

    if (!serviceAreaMaskRef.current) {
      serviceAreaMaskRef.current = new maps.Polygon({
        map,
        paths: [outerMaskPath, ...SERVICE_AREA_HOLE_PATHS],
        fillColor: "#020617",
        fillOpacity: 0.16,
        strokeOpacity: 0,
        clickable: false,
        zIndex: 2,
      });
    } else {
      serviceAreaMaskRef.current.setMap(map);
      serviceAreaMaskRef.current.setPaths([outerMaskPath, ...SERVICE_AREA_HOLE_PATHS]);
    }
  }

  if (!serviceAreaOutlineRefs.current.length) {
    serviceAreaOutlineRefs.current = SERVICE_AREA_PATHS.map(
      (path) =>
        new maps.Polygon({
          map,
          paths: path,
          fillOpacity: 0,
          strokeColor: "#2563eb",
          strokeOpacity: 0.98,
          strokeWeight: 4,
          clickable: false,
          zIndex: 3,
        })
    );
    return;
  }

  serviceAreaOutlineRefs.current.forEach((outline, index) => {
    outline.setMap(map);
    outline.setPaths(SERVICE_AREA_PATHS[index]);
  });
}

function providerVerificationBadge(status: AdminProviderVerificationRecord["status"]) {
  if (status === "approved") return { label: "Aprovado", tone: badge("emerald") };
  if (status === "rejected") return { label: "Recusado", tone: badge("rose") };
  if (status === "under_review") return { label: "Em análise", tone: badge("blue") };
  if (status === "changes_requested") return { label: "Reenvio solicitado", tone: badge("amber") };
  return { label: "Aguardando documentos", tone: badge("slate") };
}

function formatBirthDate(value: string) {
  const [year, month, day] = String(value ?? "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value || "-";
}

function ProviderVerificationSection({
  providers,
  allProviders,
  tab,
  isLoading,
  updatingId,
  notes,
  onTabChange,
  onNoteChange,
  onAction,
}: {
  providers: AdminProviderVerificationRecord[];
  allProviders: AdminProviderVerificationRecord[];
  tab: VerificationTab;
  isLoading: boolean;
  updatingId: string | null;
  notes: Record<string, string>;
  onTabChange: (tab: VerificationTab) => void;
  onNoteChange: (providerId: string, value: string) => void;
  onAction: (
    providerId: string,
    action: "approve" | "request-documents" | "reject"
  ) => void;
}) {
  const count = (statuses: AdminProviderVerificationRecord["status"][]) =>
    allProviders.filter((provider) => statuses.includes(provider.status)).length;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Verificação de prestadores</h2>
          <p className="mt-1 text-sm text-slate-400">
            Confira identidade e documentos antes de liberar o acesso ao mapa e à carteira.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${badge("blue")}`}>
          {count(["under_review"])} para analisar
        </span>
      </div>

      <SegmentedTabs
        value={tab}
        items={[
          ["review", `Em análise (${count(["under_review"])})`],
          ["waiting", `Aguardando (${count(["pending_documents", "changes_requested"])})`],
          ["approved", `Aprovados (${count(["approved"])})`],
          ["rejected", `Recusados (${count(["rejected"])})`],
          ["all", `Todos (${allProviders.length})`],
        ]}
        onChange={(value) => onTabChange(value as VerificationTab)}
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {isLoading ? (
          <EmptyPanel text="Carregando verificações..." />
        ) : providers.length ? (
          providers.map((provider) => (
            <ProviderVerificationCard
              key={provider.id}
              provider={provider}
              note={notes[provider.id] ?? ""}
              isBusy={updatingId === provider.id}
              onNoteChange={(value) => onNoteChange(provider.id, value)}
              onAction={(action) => onAction(provider.id, action)}
            />
          ))
        ) : (
          <EmptyPanel text="Nenhum prestador neste filtro." />
        )}
      </div>
    </section>
  );
}

function ProviderVerificationCard({
  provider,
  note,
  isBusy,
  onNoteChange,
  onAction,
}: {
  provider: AdminProviderVerificationRecord;
  note: string;
  isBusy: boolean;
  onNoteChange: (value: string) => void;
  onAction: (action: "approve" | "request-documents" | "reject") => void;
}) {
  const status = providerVerificationBadge(provider.status);
  const canReview = ["pending_documents", "under_review", "changes_requested"].includes(
    provider.status
  );

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 font-bold">
            {provider.avatar ? (
              <img src={provider.avatar} alt={provider.fullName} className="h-full w-full object-cover" />
            ) : (
              getInitials(provider.fullName)
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-white">{provider.fullName}</h3>
            <p className="truncate text-xs text-slate-400">{provider.email}</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <VerificationDatum label="Telefone" value={provider.phone || "-"} />
        <VerificationDatum label="Nascimento" value={formatBirthDate(provider.birthDate)} />
        <VerificationDatum label="CPF" value={provider.cpf || "Não enviado"} />
        <VerificationDatum label="RG" value={provider.rgNumber || "Não enviado"} />
        <VerificationDatum label="Cadastro" value={formatDate(provider.createdAt, true)} />
        <VerificationDatum label="Envio" value={formatDate(provider.submittedAt, true)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <VerificationDocument title="Foto do rosto" image={provider.faceImage} />
        <VerificationDocument title="Documento RG" image={provider.rgDocumentImage} />
      </div>

      {provider.requestedReason || provider.decisionNote ? (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs leading-5 text-slate-300">
          <strong>Última mensagem:</strong> {provider.requestedReason || provider.decisionNote}
          {provider.reviewerName ? <span className="mt-1 block text-slate-500">Por {provider.reviewerName}</span> : null}
        </div>
      ) : null}

      {canReview ? (
        <>
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={3}
            placeholder="Motivo obrigatório para solicitar novamente ou recusar"
            className="mt-4 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button type="button" disabled={isBusy || provider.status !== "under_review"} onClick={() => onAction("approve")} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {isBusy ? "Salvando..." : "Aprovar"}
            </button>
            <button type="button" disabled={isBusy} onClick={() => onAction("request-documents")} className="rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-40">
              Solicitar novamente
            </button>
            <button type="button" disabled={isBusy} onClick={() => onAction("reject")} className="rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              Recusar
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}

function VerificationDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function VerificationDocument({ title, image }: { title: string; image: string | null }) {
  if (!image) {
    return <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 text-sm text-slate-500">{title} não enviado</div>;
  }

  return (
    <a href={image} target="_blank" rel="noreferrer" className="group relative block h-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      <img src={image} alt={title} className="h-full w-full object-contain transition group-hover:scale-[1.02]" />
      <span className="absolute bottom-2 left-2 rounded-lg bg-slate-950/90 px-2 py-1 text-xs font-semibold text-white">{title} · ampliar</span>
    </a>
  );
}

function UsersSection({
  users,
  isLoading,
  userTab,
  userSearch,
  updatingUserId,
  onUserTabChange,
  onSearchChange,
  onAdminAction,
  onDeleteUser,
  onExport,
}: {
  users: AdminUserRecord[];
  isLoading: boolean;
  userTab: UserTab;
  userSearch: string;
  updatingUserId: string | null;
  onUserTabChange: (tab: UserTab) => void;
  onSearchChange: (value: string) => void;
  onAdminAction: (
    targetUserId: string,
    action: "flag" | "clear-flag" | "suspend" | "reinstate",
    reason: string
  ) => Promise<void>;
  onDeleteUser: (user: AdminUserRecord) => void;
  onExport: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <Toolbar title="Usuários(as)" onExport={onExport}>
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={userSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
      </Toolbar>

      <SegmentedTabs
        value={userTab}
        items={[
          ["all", "Todos"],
          ["new", "Novos"],
          ["verified", "Verificados"],
          ["pending", "Pendentes"],
        ]}
        onChange={(value) => onUserTabChange(value as UserTab)}
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[1.4fr_1.1fr_1fr_1fr_1fr] gap-3 bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <span>Usuário</span>
            <span>Contato</span>
            <span>Validação</span>
            <span>Fluxo</span>
            <span>Ações</span>
          </div>
          {isLoading ? (
            <EmptyPanel text="Carregando usuários(as)..." />
          ) : users.length ? (
            users.map((entry) => (
              <UserRow
                key={entry.id}
                entry={entry}
                isBusy={updatingUserId === entry.id}
                onAdminAction={onAdminAction}
                onDeleteUser={onDeleteUser}
              />
            ))
          ) : (
            <EmptyPanel text="Nenhum usuário encontrado." />
          )}
        </div>
      </div>
    </section>
  );
}

function RequestsSection({
  requests,
  statusCounts,
  isLoading,
  requestTab,
  resolutionNote,
  resolvingId,
  onRequestTabChange,
  onChangeNote,
  onResolve,
  onExport,
}: {
  requests: AdminServiceRequestRecord[];
  statusCounts: Array<{ status: string; total: number }>;
  isLoading: boolean;
  requestTab: RequestTab;
  resolutionNote: Record<string, string>;
  resolvingId: string | null;
  onRequestTabChange: (tab: RequestTab) => void;
  onChangeNote: (requestId: string, value: string) => void;
  onResolve: (request: AdminServiceRequestRecord, action: "continue" | "refund") => void;
  onExport: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <Toolbar title="Pedidos" onExport={onExport} />
      <SegmentedTabs
        value={requestTab}
        items={[
          ["all", "Todos"],
          ["map", "Mapa"],
          ["live", "Em fluxo"],
          ["disputes", "Disputas"],
        ]}
        onChange={(value) => onRequestTabChange(value as RequestTab)}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {statusCounts.map((entry) => (
          <span key={entry.status} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${requestBadge(entry.status)}`}>
            {entry.status}: {entry.total}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {isLoading ? (
          <EmptyPanel text="Carregando pedidos..." />
        ) : requests.length ? (
          requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              resolutionNote={resolutionNote[request.id] ?? ""}
              resolving={resolvingId === request.id}
              onChangeNote={(value) => onChangeNote(request.id, value)}
              onResolve={(action) => onResolve(request, action)}
            />
          ))
        ) : (
          <EmptyPanel text="Nenhum pedido neste filtro." />
        )}
      </div>
    </section>
  );
}

function ActiveChatsSection({ chats }: { chats: AdminMonitoredChat[] }) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(chats[0]?.id ?? null);
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? chats[0] ?? null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Monitoramento</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Chats ativos agora</h2>
          <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-200">
            {chats.length} ativo{chats.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">Leitura administrativa para segurança e moderação.</p>
      </div>

      {chats.length === 0 ? (
        <EmptyPanel text="Nenhum chat ativo neste momento." />
      ) : (
        <div className="grid min-h-[560px] md:grid-cols-[320px_1fr]">
          <div className="max-h-[70vh] overflow-y-auto border-r border-slate-800 p-2 custom-scrollbar">
            {chats.map((chat) => {
              const lastMessage = chat.messages.at(-1);
              const selected = selectedChat?.id === chat.id;

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`mb-1 w-full rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-blue-500/60 bg-blue-500/10"
                      : "border-transparent bg-slate-900 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-sm text-white">{chat.requesterName} ↔ {chat.workerName}</strong>
                    <span className="shrink-0 text-[10px] text-slate-500">{formatDate(chat.updatedAt, true)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-blue-300">{chat.category} · {chat.status}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">{lastMessage?.body || "Aguardando primeira mensagem"}</p>
                </button>
              );
            })}
          </div>

          {selectedChat ? (
            <div className="flex min-h-0 flex-col bg-slate-900">
              <header className="border-b border-slate-800 px-4 py-3">
                <h3 className="font-bold text-white">{selectedChat.requesterName} e {selectedChat.workerName}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {selectedChat.kind === "service" ? "Atendimento" : "Conversa de divulgação"} · {selectedChat.description}
                </p>
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
                {selectedChat.messages.length > 0 ? selectedChat.messages.map((message) => (
                  <article key={message.id} className="max-w-[82%] rounded-2xl bg-slate-800 px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-xs text-blue-300">{message.senderName}</strong>
                      <span className="text-[10px] text-slate-500">{formatDate(message.createdAt, true)}</span>
                    </div>
                    {message.messageType === "image" && message.imageUrl ? (
                      <a href={message.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                        <img src={message.imageUrl} alt="Imagem enviada no chat" className="max-h-52 rounded-xl object-contain" />
                      </a>
                    ) : null}
                    {message.body ? <p className="mt-1 break-words text-sm leading-5 text-slate-100">{message.body}</p> : null}
                  </article>
                )) : (
                  <p className="py-12 text-center text-sm text-slate-500">A conversa ainda não possui mensagens.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function WalletSection({ withdrawals }: { withdrawals: AdminDashboard["withdrawals"] }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <h2 className="text-lg font-bold text-white">Carteira</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {withdrawals.length ? (
          withdrawals.slice(0, 16).map((withdrawal) => (
            <div key={withdrawal.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-50">{withdrawal.userName}</p>
                  <p className="truncate text-xs text-slate-400">{withdrawal.userEmail}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge(PENDING_WITHDRAWAL_STATUSES.has(withdrawal.status) ? "amber" : withdrawal.status === "DONE" ? "emerald" : "slate")}`}>
                  {withdrawal.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MoneyCard label="Líquido" amount={withdrawal.amountCents} />
                <MoneyCard label="Bruto" amount={withdrawal.grossAmountCents} />
                <MoneyCard label="Taxa" amount={withdrawal.feeAmountCents} />
              </div>
              <p className="mt-3 text-xs text-slate-500">{withdrawal.mode === "instant" ? "Instantâneo" : "Padrão"} em {formatDate(withdrawal.createdAt, true)}</p>
            </div>
          ))
        ) : (
          <EmptyPanel text="Nenhum saque registrado." />
        )}
      </div>
    </section>
  );
}

function SystemSection({ health }: { health: AdminHealthSnapshot | null }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <CompactPanel title="Integrações">
        <div className="flex flex-wrap gap-2">
          <HealthChip label="Pagamentos" active={Boolean(health?.integrations.asaasConfigured)} />
          <HealthChip label="E-mail" active={Boolean(health?.integrations.emailConfigured)} />
          <HealthChip label="Maps" active={Boolean(health?.integrations.mapsConfigured)} />
          <HealthChip label="Push" active={Boolean(health?.integrations.fcmConfigured)} />
          <HealthChip label="CPF" active={Boolean(health?.integrations.cpfConfigured)} />
        </div>
      </CompactPanel>

      <CompactPanel title="Operação">
        <StatGrid
          items={[
            ["Requests", health?.metrics.totalRequests ?? 0],
            ["Erros", health?.metrics.totalServerErrors ?? 0],
            ["Relatérios", health?.metrics.clientReportsStored ?? 0],
            ["Último erro", formatDate(health?.metrics.lastServerErrorAt ?? null, true)],
          ]}
        />
      </CompactPanel>

      <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <h2 className="text-lg font-bold text-white">Erros recentes</h2>
        <div className="mt-4 grid gap-3">
          {health?.metrics.recentErrors?.length ? (
            health.metrics.recentErrors.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-50">{entry.name}</p>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${entry.statusCode && entry.statusCode >= 500 ? badge("rose") : badge("amber")}`}>
                    {entry.statusCode ?? "sem código"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{entry.message}</p>
                <p className="mt-2 text-xs text-slate-500">{entry.pathname || "sem rota"} é {formatDate(entry.createdAt, true)}</p>
              </div>
            ))
          ) : (
            <EmptyPanel text="Nenhum erro recente." />
          )}
        </div>
      </div>
    </section>
  );
}

function Toolbar({
  title,
  children,
  onExport,
}: {
  title: string;
  children?: React.ReactNode;
  onExport?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
        {children}
        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SegmentedTabs({
  value,
  items,
  onChange,
}: {
  value: string;
  items: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            value === id
              ? "border-blue-400/50 bg-blue-500/20 text-white"
              : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "blue" | "emerald" | "amber" | "rose" | "slate";
}) {
  const panelTone = {
    blue: "border-blue-500/35",
    emerald: "border-emerald-500/35",
    amber: "border-amber-500/35",
    rose: "border-rose-500/35",
    slate: "border-slate-700",
  }[tone];

  return (
    <div className={`rounded-2xl border bg-slate-900 p-4 ${panelTone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-slate-300" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-50">{value}</p>
    </div>
  );
}

function CompactPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatGrid({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-base font-semibold text-slate-50">{value}</p>
        </div>
      ))}
    </div>
  );
}

function HealthChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? badge("emerald") : badge("rose")}`}>
      {label} {active ? "ok" : "pendente"}
    </span>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 px-4 py-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function UserRow({
  entry,
  isBusy,
  onAdminAction,
  onDeleteUser,
}: {
  entry: AdminUserRecord;
  isBusy: boolean;
  onAdminAction: (
    targetUserId: string,
    action: "flag" | "clear-flag" | "suspend" | "reinstate",
    reason: string
  ) => Promise<void>;
  onDeleteUser: (user: AdminUserRecord) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="grid grid-cols-[1.4fr_1.1fr_1fr_1fr_1fr] gap-3 border-t border-slate-800 px-4 py-4 text-sm text-slate-200">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-sm font-bold text-slate-200">
          {entry.avatar ? <img src={entry.avatar} alt={entry.fullName} className="h-full w-full object-cover" /> : getInitials(entry.fullName)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-50">{entry.fullName}</p>
          <p className="mt-1 text-xs text-slate-500">ativo {since(entry.lastActiveAt)}</p>
        </div>
      </div>
      <div className="min-w-0 text-slate-300">
        <p className="truncate">{entry.email}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{entry.phone || "-"}</p>
      </div>
      <div className="space-y-1 text-slate-300">
        <p>{entry.emailVerifiedAt ? "E-mail ok" : "E-mail pendente"}</p>
        <p>{entry.cpfVerifiedAt ? "CPF ok" : "CPF pendente"}</p>
        <p>{entry.profileCompletedAt ? "Perfil ok" : "Perfil pendente"}</p>
      </div>
      <div className="space-y-1 text-slate-300">
        <p>Pedidos: {entry.requestsCreatedCount}</p>
        <p>Jobs: {entry.jobsTakenCount}</p>
        <p>SAC: {entry.openSupportTickets}</p>
      </div>
      <div className="space-y-2">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value.slice(0, 240))}
          placeholder="Motivo"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isBusy || entry.isAdmin}
            onClick={() => void onAdminAction(entry.id, entry.isFlagged ? "clear-flag" : "flag", reason)}
            className="rounded-lg border border-amber-500/40 bg-amber-500/12 px-2 py-2 text-xs font-semibold text-amber-100 disabled:opacity-60"
          >
            {entry.isFlagged ? "Limpar" : "Sinalizar"}
          </button>
          <button
            type="button"
            disabled={isBusy || entry.isAdmin}
            onClick={() => void onAdminAction(entry.id, entry.isSuspended ? "reinstate" : "suspend", reason)}
            className="rounded-lg border border-rose-500/40 bg-rose-500/12 px-2 py-2 text-xs font-semibold text-rose-100 disabled:opacity-60"
          >
            {entry.isSuspended ? "Reativar" : "Suspender"}
          </button>
        </div>
        <button
          type="button"
          disabled={isBusy || entry.isAdmin}
          onClick={() => onDeleteUser(entry)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-600/50 bg-rose-950/50 px-2 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/60 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir usuário(a)
        </button>
      </div>
    </div>
  );
}

function MoneyCard({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-50">{formatCurrencyAmount(amount / 100)}</p>
    </div>
  );
}

function RequestCard({
  request,
  resolutionNote,
  resolving,
  onChangeNote,
  onResolve,
}: {
  request: AdminServiceRequestRecord;
  resolutionNote: string;
  resolving: boolean;
  onChangeNote: (value: string) => void;
  onResolve: (action: "continue" | "refund") => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${requestBadge(request.status)}`}>{request.status}</span>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-200">{request.category}</span>
            {request.dispute?.status === "open" ? (
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge("rose")}`}>
                {request.dispute.kind === "provider-no-show" ? "Ausência / ressarcimento" : "Disputa"}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-base font-semibold text-slate-50">
            {request.agreementTitle || request.description}
          </p>
          {request.agreementTitle ? (
            <p className="mt-1 text-sm text-slate-400">{request.description}</p>
          ) : null}
          <div className="mt-2 grid gap-1 text-sm text-slate-300">
            <p>Cliente: {request.requesterName}</p>
            <p>Profissional: {request.workerName ?? "Não assumido(a)"}</p>
            {request.workerNoShowCount > 0 ? (
              <p className="font-semibold text-rose-300">
                Ocorrências confirmadas de ausência: {request.workerNoShowCount}
              </p>
            ) : null}
            <p>{formatDate(request.createdAt, true)} é {formatDate(request.updatedAt, true)}</p>
          </div>
        </div>
        <div className="grid min-w-[240px] grid-cols-3 gap-2">
          <MoneyCard label="Serviço" amount={request.subtotalCents} />
          <MoneyCard label="Taxa" amount={request.feeCents} />
          <MoneyCard label="Total" amount={request.totalCents} />
        </div>
      </div>

      {request.dispute ? (
        <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/12 p-4">
          <p className="text-sm font-semibold text-rose-100">
            {request.dispute.kind === "provider-no-show"
              ? "Solicitação de ressarcimento por ausência"
              : "Disputa"}
          </p>
          <p className="mt-2 text-sm text-rose-100">{request.dispute.reason}</p>
          {request.dispute.evidenceImage ? (
            <a
              href={request.dispute.evidenceImage}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block overflow-hidden rounded-xl border border-rose-400/30 bg-slate-950"
            >
              <img
                src={request.dispute.evidenceImage}
                alt="Evidência enviada pelo cliente"
                className="max-h-64 w-full object-contain"
              />
              <span className="block px-3 py-2 text-xs font-semibold text-rose-100">
                Abrir evidência em tamanho completo
              </span>
            </a>
          ) : null}
          {request.dispute.kind === "provider-no-show" ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                <span className="block font-semibold text-slate-400">Prazo de resposta</span>
                {formatDate(request.dispute.responseDueAt)}
              </div>
              <div className="rounded-xl bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
                <span className="block font-semibold text-slate-400">Resposta do prestador</span>
                {request.dispute.providerResponse || "Ainda não respondeu"}
              </div>
            </div>
          ) : null}
          {request.dispute.status === "open" ? (
            <>
              <textarea
                value={resolutionNote}
                onChange={(event) => onChangeNote(event.target.value)}
                rows={3}
                placeholder="Nota administrativa"
                className="mt-3 w-full resize-none rounded-xl border border-rose-400/35 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => onResolve("continue")} disabled={resolving} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-70">
                  {resolving ? "Salvando..." : "Manter atendimento"}
                </button>
                <button type="button" onClick={() => onResolve("refund")} disabled={resolving} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-70">
                  {resolving ? "Ressarcindo..." : "Ressarcir valor total"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

