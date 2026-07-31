import { LocalNotifications } from "@capacitor/local-notifications";
import {
  BellRing,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  House,
  Map,
  MessageCircle,
  User,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { useBootSplash } from "../hooks/useBootSplash";
import { useNativePermissionBootstrap } from "../hooks/useNativePermissionBootstrap";
import { resolveNotificationRouteTarget } from "../lib/notificationRouting";
import { initializeNativePushNotifications } from "../lib/pushNotifications";
import { BrandSplash } from "./BrandSplash";
import { FloatingBackButton } from "./ui/FloatingBackButton";
import { cn } from "./ui/utils";
import logoTop from "@/assets/logosup.png";

const NOTIFICATION_TOAST_DURATION_MS = 4000;
const MESSAGE_NOTIFICATION_TOAST_DURATION_MS = 5000;
const APP_TOUR_VERSION = "v2";

function AppLoadingScreen() {
  return <BrandSplash />;
}

function compactToastMessage(message: string, isChatMessage: boolean) {
  const normalized = String(message ?? "").trim();

  if (!isChatMessage) {
    return normalized;
  }

  const separatorIndex = normalized.indexOf(":");
  return separatorIndex > 0 ? normalized.slice(separatorIndex + 1).trimStart() : normalized;
}

function isChatVisualNotification(kind: string) {
  return kind === "chat-message" || kind === "chat-request";
}

type AppTourStep = {
  id: string;
  path: string;
  title: string;
  body: string;
};

function getAppTourStorageKey(userId: string) {
  return `worqo-app-tour:${APP_TOUR_VERSION}:${userId}`;
}

function AppUsageTour({
  steps,
  userId,
  completedAt,
  onComplete,
  onActiveStepChange,
}: {
  steps: AppTourStep[];
  userId: string;
  completedAt: string | null;
  onComplete: () => Promise<unknown>;
  onActiveStepChange: (stepId: string | null) => void;
}) {
  const navigate = useNavigate();
  const completionSyncRef = useRef(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isSkipConfirmOpen, setIsSkipConfirmOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const activeStep = steps[stepIndex] ?? null;

  useEffect(() => {
    if (!userId || steps.length === 0 || typeof window === "undefined") {
      setIsVisible(false);
      return;
    }

    const storageKey = getAppTourStorageKey(userId);
    const hasFinishedTourLocally = window.localStorage.getItem(storageKey) === "done";

    if (completedAt) {
      window.localStorage.setItem(storageKey, "done");
      setIsVisible(false);
      return;
    }

    if (hasFinishedTourLocally) {
      setIsVisible(false);

      if (!completionSyncRef.current) {
        completionSyncRef.current = true;
        void onComplete();
      }
      return;
    }

    completionSyncRef.current = false;
    setIsVisible(true);
  }, [completedAt, onComplete, steps.length, userId]);

  useEffect(() => {
    onActiveStepChange(isVisible && activeStep ? activeStep.id : null);
  }, [activeStep?.id, isVisible, onActiveStepChange]);

  useEffect(() => {
    if (!isVisible || !activeStep) {
      return;
    }

    navigate(activeStep.path, { replace: true });
  }, [activeStep?.path, isVisible, navigate]);

  function finishTour() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getAppTourStorageKey(userId), "done");
    }

    onActiveStepChange(null);
    setIsVisible(false);
    void onComplete();
  }

  function requestSkipTour() {
    setIsSkipConfirmOpen(true);
  }

  if (!isVisible || !activeStep) {
    return null;
  }

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="app-usage-tour"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-[75] px-4"
      >
        <div className="app-tour-card mx-auto w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                Dicas rápidas
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{activeStep.title}</h2>
            </div>

            <button
              type="button"
              onClick={requestSkipTour}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar tutorial"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">{activeStep.body}</p>

          <div className="mt-4 flex items-center gap-2">
            {steps.map((step, index) => (
              <span
                key={step.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  index === stepIndex ? "bg-blue-600" : "bg-slate-200"
                )}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
              disabled={isFirstStep}
              className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            <button
              type="button"
              onClick={requestSkipTour}
              className="inline-flex h-11 min-w-0 items-center justify-center rounded-2xl px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              Pular
            </button>

            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  finishTour();
                  return;
                }

                setStepIndex((current) => Math.min(current + 1, steps.length - 1));
              }}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {isLastStep ? "Concluir" : "Próximo"}
              {!isLastStep ? <ChevronRight className="h-4 w-4" /> : null}
            </button>
          </div>
        </div>

        {isSkipConfirmOpen ? (
          <div className="fixed inset-0 z-[76] flex items-end justify-center bg-slate-950/35 p-4 sm:items-center">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <h3 className="text-lg font-bold text-slate-950">Pular dicas?</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Você pode usar o app normalmente, mas essas dicas não aparecerão de novo automaticamente.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsSkipConfirmOpen(false)}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={finishTour}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
                >
                  Pular dicas
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const bootSplashVisible = useBootSplash();
  const [hasScrollableContent, setHasScrollableContent] = useState(false);
  const [activeTourStepId, setActiveTourStepId] = useState<string | null>(null);
  const shellHorizontalInset = "max(16px, env(safe-area-inset-left, 0px))";
  const shellRightInset = "max(16px, env(safe-area-inset-right, 0px))";
  const navBottomInset = "calc(12px + env(safe-area-inset-bottom, 0px))";
  const contentBottomInset = "calc(116px + env(safe-area-inset-bottom, 0px))";
  const {
    state: {
      authReady,
      chats,
      isAuthenticated,
      notifications,
      onboardingStep,
      sessionToken,
      user,
    },
    dismissNotification,
    markNotificationRead,
    openChat,
    refreshSessionState,
    completeAppTour,
  } = useApp();
  const isClientShell = user?.accountKind === "client";
  const isMapRoute = location.pathname === "/app" && !isClientShell;
  const isClientHomeRoute = location.pathname === "/app" && isClientShell;
  const isMuralRoute = location.pathname === "/app/mural";
  const isChatRoute = location.pathname === "/app/chat";
  const isOrdersRoute = location.pathname === "/app/orders";
  const isServiceRoute = location.pathname.startsWith("/app/service");
  const isMainWalletRoute = location.pathname === "/app/wallet";
  const isMainProfileRoute = location.pathname === "/app/profile";
  const shouldShowTopBar =
    isMapRoute ||
    isClientHomeRoute ||
    isMuralRoute ||
    isChatRoute ||
    isOrdersRoute ||
    isMainWalletRoute ||
    isMainProfileRoute;
  const isProfileSubRoute = location.pathname.startsWith("/app/profile/");
  const canShowScrollableBackButton =
    !isMapRoute &&
    !isClientHomeRoute &&
    !isMuralRoute &&
    !isChatRoute &&
    !isOrdersRoute &&
    !isMainWalletRoute &&
    !isMainProfileRoute &&
    !isProfileSubRoute;
  const floatingBackTarget = location.pathname.startsWith("/app/profile/")
    ? "/app/profile"
    : undefined;
  const totalUnread = chats.reduce((sum, chat) => sum + chat.unread, 0);
  const unreadNotificationCount = notifications.filter(
    (notification) => notification.kind !== "chat-message" && !notification.readAt
  ).length;
  const shouldHideNotificationToast = (notification: (typeof notifications)[number]) => {
    if (notification.kind !== "chat-message") {
      return false;
    }

    return isChatRoute;
  };
  const hiddenToastNotificationIds = notifications
    .filter((notification) => !notification.toastDismissedAt && shouldHideNotificationToast(notification))
    .map((notification) => notification.id);
  const hiddenToastNotificationIdsKey = hiddenToastNotificationIds.join("|");
  const activeToastNotification =
    notifications.find(
      (notification) => !notification.toastDismissedAt && !shouldHideNotificationToast(notification)
    ) ?? null;
  const visibleToastNotificationIds = notifications
    .filter((notification) => !notification.toastDismissedAt && !shouldHideNotificationToast(notification))
    .map((notification) => notification.id);
  const visibleToastNotificationIdsKey = visibleToastNotificationIds.join("|");
  const refreshSessionStateRef = useRef(refreshSessionState);
  const navigateRef = useRef(navigate);
  const openChatRef = useRef(openChat);
  const toastDismissTimersRef = useRef<globalThis.Map<string, number>>(
    new globalThis.Map()
  );

  useEffect(() => {
    refreshSessionStateRef.current = refreshSessionState;
    navigateRef.current = navigate;
    openChatRef.current = openChat;
  }, [navigate, openChat, refreshSessionState]);

  useEffect(() => {
    window.dispatchEvent(new Event("worqo-route-change"));
  }, [location.pathname]);

  useEffect(() => {
    if (!hiddenToastNotificationIdsKey) {
      return;
    }

    hiddenToastNotificationIds.forEach((notificationId) => {
      dismissNotification(notificationId);
    });
  }, [dismissNotification, hiddenToastNotificationIdsKey]);

  useEffect(() => {
    const activeVisibleIds = new Set(visibleToastNotificationIds);

    for (const [notificationId, timeoutId] of toastDismissTimersRef.current) {
      if (!activeVisibleIds.has(notificationId)) {
        window.clearTimeout(timeoutId);
        toastDismissTimersRef.current.delete(notificationId);
      }
    }

    notifications
      .filter(
        (notification) =>
          !notification.toastDismissedAt && !shouldHideNotificationToast(notification)
      )
      .forEach((notification) => {
        if (toastDismissTimersRef.current.has(notification.id)) {
          return;
        }

        const toastDurationMs = isChatVisualNotification(notification.kind)
          ? MESSAGE_NOTIFICATION_TOAST_DURATION_MS
          : NOTIFICATION_TOAST_DURATION_MS;
        const timeoutId = window.setTimeout(() => {
          toastDismissTimersRef.current.delete(notification.id);
          dismissNotification(notification.id);
        }, toastDurationMs);

        toastDismissTimersRef.current.set(notification.id, timeoutId);
      });
  }, [dismissNotification, notifications, visibleToastNotificationIdsKey]);

  useEffect(() => {
    if (!activeToastNotification) {
      return;
    }

    visibleToastNotificationIds
      .filter((notificationId) => notificationId !== activeToastNotification.id)
      .forEach((notificationId) => {
        dismissNotification(notificationId);
      });
  }, [activeToastNotification?.id, dismissNotification, visibleToastNotificationIdsKey]);

  useEffect(() => {
    return () => {
      for (const timeoutId of toastDismissTimersRef.current.values()) {
        window.clearTimeout(timeoutId);
      }

      toastDismissTimersRef.current.clear();
    };
  }, []);

  const handleNotificationNavigation = async (notification: {
    id?: string | null;
    kind?: string | null;
    chatId?: string | null;
    data?: Record<string, unknown> | null;
  }) => {
    const notificationId = String(notification.id || notification.data?.id || "").trim();

    if (notificationId) {
      markNotificationRead(notificationId);
      dismissNotification(notificationId);
    }

    const target = resolveNotificationRouteTarget(notification);

    if (target.chatId) {
      openChatRef.current(target.chatId);
    }

    navigateRef.current(target.path);
  };

  useLayoutEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    const node = contentRef.current;

    if (!node || !canShowScrollableBackButton) {
      setHasScrollableContent(false);
      return;
    }

    const updateScrollableState = () => {
      setHasScrollableContent(node.scrollHeight > node.clientHeight + 8);
    };

    updateScrollableState();
    const timeoutId = window.setTimeout(updateScrollableState, 280);
    const resizeObserver = new ResizeObserver(updateScrollableState);
    resizeObserver.observe(node);

    if (node.firstElementChild) {
      resizeObserver.observe(node.firstElementChild);
    }

    window.addEventListener("resize", updateScrollableState);

    return () => {
      window.clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollableState);
    };
  }, [canShowScrollableBackButton, location.pathname]);

  useNativePermissionBootstrap(!bootSplashVisible && onboardingStep === "app");

  useEffect(() => {
    if (
      bootSplashVisible ||
      onboardingStep !== "app" ||
      !isAuthenticated ||
      !user ||
      !sessionToken
    ) {
      return;
    }

    let cancelled = false;
    let dispose = () => undefined;
    let removeLocalNotificationListener = () => undefined;

    void (async () => {
      const nextDispose = await initializeNativePushNotifications({
        sessionToken,
        appVersion: import.meta.env.VITE_CLIENT_RELEASE ?? "",
        onNotificationReceived: async () => {
          if (cancelled) {
            return;
          }

          await refreshSessionStateRef.current().catch(() => undefined);
        },
        onNotificationAction: async ({ notification }) => {
          if (cancelled) {
            return;
          }

          await refreshSessionStateRef.current().catch(() => undefined);
          await handleNotificationNavigation({
            id: String(notification.data?.notificationId ?? notification.data?.id ?? "").trim(),
            kind: String(notification.data?.kind ?? "").trim(),
            chatId: String(notification.data?.chatId ?? "").trim() || null,
            data: notification.data ?? null,
          });
        },
        onRegistrationError: (error) => {
          console.warn("Falha ao registrar o push nativo.", error);
        },
      });

      const localNotificationListener = await LocalNotifications.addListener(
        "localNotificationActionPerformed",
        async (event) => {
          if (cancelled) {
            return;
          }

          await refreshSessionStateRef.current().catch(() => undefined);
          await handleNotificationNavigation({
            id: String(event.notification?.extra?.id ?? "").trim(),
            kind: String(event.notification?.extra?.kind ?? "").trim(),
            chatId: String(event.notification?.extra?.chatId ?? "").trim() || null,
            data:
              event.notification?.extra && typeof event.notification.extra === "object"
                ? event.notification.extra
                : null,
          });
        }
      ).catch(() => null);

      removeLocalNotificationListener = () => {
        void localNotificationListener?.remove().catch(() => undefined);
      };

      if (cancelled) {
        nextDispose();
        removeLocalNotificationListener();
        return;
      }

      dispose = nextDispose;
    })();

    return () => {
      cancelled = true;
      dispose();
      removeLocalNotificationListener();
    };
  }, [bootSplashVisible, isAuthenticated, onboardingStep, sessionToken, user?.id]);

  if (!authReady || bootSplashVisible) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    const fallback = onboardingStep === "verify" ? "/verify" : "/";
    return <Navigate to={fallback} replace />;
  }

  if (user.isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (onboardingStep === "profile-setup") {
    return <Navigate to="/profile-setup" replace />;
  }

  if (onboardingStep === "provider-verification") {
    return <Navigate to="/provider-verification" replace />;
  }

  if (onboardingStep === "provider-review") {
    return <Navigate to="/provider-review" replace />;
  }

  const isClientAccount = user.accountKind === "client";
  const routeAllowedForClient =
    location.pathname === "/app" ||
    location.pathname === "/app/chat" ||
    location.pathname === "/app/orders" ||
    location.pathname === "/app/notifications" ||
    location.pathname === "/app/profile" ||
    location.pathname.startsWith("/app/profile/") ||
    location.pathname.startsWith("/app/service/");

  if (isClientAccount && !routeAllowedForClient) {
    return <Navigate to="/app" replace />;
  }

  if (!isClientAccount && location.pathname === "/app/mural") {
    return <Navigate to="/app/chat" replace />;
  }

  const navItems = isClientAccount
    ? [
        { id: "home", path: "/app", icon: House, label: "Início" },
        { id: "chat", path: "/app/chat", icon: MessageCircle, label: "Mensagens" },
        { id: "orders", path: "/app/orders", icon: ClipboardList, label: "Pedidos" },
        { id: "profile", path: "/app/profile", icon: User, label: "Perfil" },
      ]
    : [
        { id: "home", path: "/app", icon: Map, label: "Mapa" },
        ...(user.isCpfVerified
          ? [{ id: "chat", path: "/app/chat", icon: MessageCircle, label: "Mensagens" }]
          : []),
        { id: "wallet", path: "/app/wallet", icon: WalletIcon, label: "Carteira" },
        { id: "profile", path: "/app/profile", icon: User, label: "Perfil" },
      ];
  const appTourSteps: AppTourStep[] = isClientAccount
    ? [
        {
          id: "home",
          path: "/app",
          title: "Início",
          body: "Aqui você escolhe a categoria, descreve o serviço e acompanha o pedido enquanto busca prestadores(as) próximos(as).",
        },
        {
          id: "client-map",
          path: "/app",
          title: "Local do atendimento",
          body: "O mapa mostra sua região de atendimento. Sua localização exata só é usada no fluxo do serviço e com as proteções do app.",
        },
        {
          id: "chat",
          path: "/app/chat",
          title: "Mensagens",
          body: "As conversas com prestadores(as) aparecem aqui depois que uma conversa for aceita e iniciada.",
        },
        {
          id: "orders",
          path: "/app/orders",
          title: "Pedidos",
          body: "Acompanhe serviços pagos e ativos, veja dados do atendimento, abra disputa e libere pagamento quando o serviço avançar.",
        },
        {
          id: "profile",
          path: "/app/profile",
          title: "Perfil",
          body: "Aqui ficam seus dados, validação, avaliações recebidas, termos do app, suporte e segurança da conta.",
        },
      ]
    : [
        {
          id: "home",
          path: "/app",
          title: "Mapa",
          body: "Pedidos próximos aparecem no mapa. Com CPF validado, você pode visualizar solicitações dentro da região atendida.",
        },
        {
          id: "provider-broadcast",
          path: "/app",
          title: "Divulgação",
          body: "Use o botão de divulgação para aparecer para clientes próximos por até 5 dias. Uma divulgação ativa precisa ser cancelada antes de criar outra.",
        },
        {
          id: "chat",
          path: "/app/chat",
          title: "Mensagens",
          body: "Conversas aceitas e atendimentos em andamento ficam aqui. O chat é monitorado para proteger as duas partes.",
        },
        {
          id: "wallet",
          path: "/app/wallet",
          title: "Carteira",
          body: "Veja o saldo disponível para saque, chave Pix CPF e opções de saque imediato ou grátis após 24 horas.",
        },
        {
          id: "profile",
          path: "/app/profile",
          title: "Perfil",
          body: "Mantenha foto, profissão, habilidades, disponibilidade, endereço e CPF atualizados para passar mais confiança.",
        },
      ];

  return (
    <div className="worko-native-app relative flex h-dvh w-full min-w-0 overflow-hidden bg-neutral-50">
      <div
        ref={contentRef}
        className={cn(
          "relative flex-1 min-h-0 w-full min-w-0 overflow-x-hidden",
          isMapRoute
            ? "overflow-hidden"
            : isServiceRoute
              ? "overflow-y-auto"
              : isChatRoute
                ? "overflow-hidden"
                : "overflow-y-auto"
        )}
        style={{
          ...(shouldShowTopBar
            ? { paddingTop: "calc(60px + env(safe-area-inset-top, 0px))" }
            : {}),
          ...(!isMapRoute && !isServiceRoute && !isChatRoute
            ? { paddingBottom: contentBottomInset }
            : {}),
        }}
      >
        {isClientHomeRoute || isChatRoute || isMainProfileRoute ? (
          <div className="h-full min-h-full">
            <Outlet />
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.995 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="h-full min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {shouldShowTopBar ? (
        <header
          className="app-top-bar fixed left-0 right-0 top-0 z-[55] border-b border-neutral-100 bg-white"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingLeft: shellHorizontalInset,
            paddingRight: shellRightInset,
          }}
        >
          <div className="mx-auto grid h-[60px] w-full max-w-md grid-cols-[1fr_40px] items-center">
            <img src={logoTop} alt="Worko" className="h-7 max-w-[118px] object-contain" />
            <button
              type="button"
              onClick={() =>
                navigate("/app/notifications", {
                  state: {
                    returnTo: `${location.pathname}${location.search}${location.hash}`,
                  },
                })
              }
              className="relative flex h-9 w-9 items-center justify-center justify-self-end rounded-full bg-blue-50 text-blue-600 transition active:scale-95"
              aria-label="Abrir central de notificações"
            >
              <BellRing className="h-5 w-5" />
              {unreadNotificationCount > 0 ? (
                <span className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white">
                  {Math.min(unreadNotificationCount, 99)}
                </span>
              ) : null}
            </button>
          </div>
        </header>
      ) : null}

      <AnimatePresence>
        {activeToastNotification ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed left-1/2 top-4 z-[70] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2"
          >
            <div
              onClick={() => void handleNotificationNavigation(activeToastNotification)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void handleNotificationNavigation(activeToastNotification);
                }
              }}
              className="app-toast-card pointer-events-auto cursor-pointer rounded-[24px] border border-slate-200 bg-white/96 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            >
              <div className="flex items-start gap-3">
                {isChatVisualNotification(activeToastNotification.kind) &&
                activeToastNotification.avatar ? (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700">
                    <img
                      src={activeToastNotification.avatar}
                      alt={activeToastNotification.title ?? "Notificação"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                        {activeToastNotification.title || "Notificação"}
                      </p>
                      <p className="mt-1 break-words text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                        {compactToastMessage(
                          activeToastNotification.message,
                          isChatVisualNotification(activeToastNotification.kind)
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        dismissNotification(activeToastNotification.id);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                      aria-label="Fechar notificação"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {canShowScrollableBackButton && hasScrollableContent ? (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-4 z-[60]"
            style={{
              top: "calc(16px + env(safe-area-inset-top, 0px))",
            }}
          >
            <FloatingBackButton
              to={floatingBackTarget}
              fallbackTo="/app"
              ariaLabel="Voltar"
              className="h-12 w-12 bg-white/95 text-slate-700 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isServiceRoute ? (
        <AppUsageTour
          steps={appTourSteps}
          userId={user.id}
          completedAt={user.appTourCompletedAt}
          onComplete={completeAppTour}
          onActiveStepChange={setActiveTourStepId}
        />
      ) : null}

      {!isServiceRoute && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className={cn(
            "home-route-nav app-tab-bar fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-100 bg-white px-2 pt-2 sm:px-6"
          )}
          style={{
            paddingLeft: shellHorizontalInset,
            paddingRight: shellRightInset,
            paddingBottom: navBottomInset,
          }}
        >
          <div
            className={cn(
              "mx-auto flex max-w-md items-center gap-1",
              navItems.length === 1 ? "justify-center" : "justify-between"
            )}
          >
            {navItems.map((item) => {
              const isActive =
                item.path === "/app"
                  ? location.pathname === item.path
                  : location.pathname === item.path ||
                    location.pathname.startsWith(`${item.path}/`);
              const Icon = item.icon;
              const isTourTarget = activeTourStepId === item.id;

              return (
                <motion.button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className={`relative flex h-14 w-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                    isActive
                      ? "text-blue-600"
                      : "text-neutral-400"
                  }`}
                >
                  {item.id === "chat" && totalUnread > 0 && (
                    <span className="absolute right-3 top-0 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white shadow-[0_10px_20px_rgba(37,99,235,0.28)]">
                      {Math.min(totalUnread, 9)}
                    </span>
                  )}
                  {isTourTarget ? (
                    <motion.span
                      layoutId="tour-nav-ring"
                      className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-blue-500 bg-blue-500/10"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  ) : null}
                  <Icon
                    className={`h-[22px] w-[22px] ${isActive ? "fill-blue-50" : ""}`}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  <span
                    className={`text-[9px] sm:text-[10px] ${
                      isActive ? "font-bold" : "font-medium"
                    }`}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-indicator"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="mt-0.5 h-1 w-1 rounded-full bg-blue-600"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

