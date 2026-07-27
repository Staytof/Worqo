import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Flag,
  Handshake,
  MessageCircle,
  Search,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { useApp } from "../context/AppContext";
import { useErrorToast } from "../hooks/useErrorToast";
import type { ActiveServiceRequest, PublicUserProfile } from "../types";
import {
  formatDelayTolerance,
  formatServiceDate,
  getFirstNames,
  getInitials,
  getLastItem,
  readImageAsOptimizedDataUrl,
} from "../utils/helpers";
import { PublicProfileModal } from "./profile/PublicProfileModal";
import { VerifiedBadge } from "./ui/verified-badge";

const accentMap = {
  blue: "bg-blue-600 text-white",
  emerald: "bg-emerald-600 text-white",
  amber: "bg-amber-300 text-slate-900",
  slate: "bg-slate-300 text-slate-900",
};

const chatBottomInset = "calc(88px + env(safe-area-inset-bottom, 0px))";
function isPostChat(chat: {
  serviceRequestId?: string | null;
  contactUserId?: string | null;
}) {
  return !chat.serviceRequestId && Boolean(chat.contactUserId);
}

function isPendingProviderContactRequest(
  chat: {
    serviceRequestId?: string | null;
    contactUserId?: string | null;
    messages: unknown[];
    role: string;
  },
  accountKind?: string | null
) {
  return (
    accountKind === "provider" &&
    isPostChat(chat) &&
    chat.messages.length === 0 &&
    chat.role.toLocaleLowerCase("pt-BR").includes("cliente")
  );
}

function isPendingClientContactRequest(
  chat: {
    serviceRequestId?: string | null;
    contactUserId?: string | null;
    messages: unknown[];
  },
  accountKind?: string | null
) {
  return accountKind === "client" && isPostChat(chat) && chat.messages.length === 0;
}

const reportReasons = [
  "Assédio, ameaça ou discurso ofensivo",
  "Golpe, fraude ou tentativa de pagamento por fora",
  "Compartilhamento de contato externo",
  "Conteúdo sexual, ilegal ou impróprio",
  "Spam ou comportamento abusivo",
  "Outro problema de segurança",
];

type ChatAvatarProps = {
  name: string;
  avatar: string | null;
  accent: keyof typeof accentMap;
  isVerified: boolean;
  size: "list" | "header";
  unread?: number;
};

const avatarSizeMap = {
  list: {
    container: "h-12 w-12",
    text: "text-lg",
    badgeSize: "sm" as const,
  },
  header: {
    container: "h-12 w-12 md:h-14 md:w-14",
    text: "text-lg md:text-xl",
    badgeSize: "md" as const,
  },
};

function ChatAvatar({
  name,
  avatar,
  accent,
  isVerified,
  size,
  unread = 0,
}: ChatAvatarProps) {
  const sizeClasses = avatarSizeMap[size];

  return (
    <div className={`relative shrink-0 ${sizeClasses.container}`}>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full shadow-inner ${
          avatar ? "bg-slate-200" : accentMap[accent]
        }`}
      >
        {avatar ? (
          <img src={avatar} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className={`font-bold ${sizeClasses.text}`}>{getInitials(name)}</span>
        )}
      </div>

      {isVerified && (
        <VerifiedBadge
          size={sizeClasses.badgeSize}
          title={`${name} verificado`}
          className="absolute -bottom-0.5 -right-0.5"
        />
      )}

      {unread > 0 && (
        <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
      )}
    </div>
  );
}

function PresenceDot({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      title={isOnline ? "Online" : "Offline"}
      aria-label={isOnline ? "Online" : "Offline"}
      className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${
        isOnline ? "bg-emerald-500" : "bg-slate-300"
      }`}
    />
  );
}

function inferAccountKindFromChatRole(role: string): PublicUserProfile["accountKind"] {
  const normalized = role.toLocaleLowerCase("pt-BR");

  if (normalized.includes("cliente")) {
    return "client";
  }

  if (normalized.includes("profissional") || normalized.includes("prestador")) {
    return "provider";
  }

  return null;
}

function isProviderChatRole(role: string) {
  const normalized = role.toLocaleLowerCase("pt-BR");
  return normalized.includes("profissional") || normalized.includes("prestador");
}

function getActiveServiceStatusLabel(request: ActiveServiceRequest | null) {
  if (!request) {
    return "Etapa em andamento";
  }

  if (request.status === "waiting-worker") {
    return "Aguardando confirmação";
  }

  if (request.status === "payment") {
    return "Pronto para pagamento";
  }

  if (request.status === "confirmed") {
    return "Atendimento confirmado";
  }

  if (request.status === "completed") {
    return "Concluído";
  }

  return "Etapa em andamento";
}

function getVisibleServiceLocation(request: ActiveServiceRequest | null) {
  if (!request?.details) {
    return "";
  }

  if (request.currentUserRole !== "requester") {
    return "Local protegido pelo Worko";
  }

  if (request.details.locationMode === "residence") {
    return request.details.address || "Endereço do perfil";
  }

  return request.details.address || "Local combinado no chat";
}

export function ChatList() {
  const navigate = useNavigate();
  const endRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const {
    state: { chats, activeChatId, activeServiceRequest, user },
    advanceServiceToPayment,
    clearActiveChat,
    confirmServiceDeal,
    deleteActiveServiceRequest,
    declineContactRequest,
    openChat,
    removeChatThread,
    reportChatConduct,
    sendMessage,
    startServiceFromChat,
  } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isClosingDealOpen, setIsClosingDealOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isChatRulesOpen, setIsChatRulesOpen] = useState(false);
  const [isServiceSummaryOpen, setIsServiceSummaryOpen] = useState(false);
  const [isDeleteServiceOpen, setIsDeleteServiceOpen] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportFeedback, setReportFeedback] = useState("");
  const [deleteServiceError, setDeleteServiceError] = useState("");
  const [isConfirmingDetails, setIsConfirmingDetails] = useState(false);
  const [isDeletingService, setIsDeletingService] = useState(false);
  const [isStartingService, setIsStartingService] = useState(false);
  const [revealedChatId, setRevealedChatId] = useState<string | null>(null);
  const [chatDeleteConfirmationId, setChatDeleteConfirmationId] = useState<string | null>(null);
  const [contactRequestAction, setContactRequestAction] = useState<"accept" | "decline" | null>(
    null
  );
  useErrorToast(messageError);
  useErrorToast(reportFeedback && !reportFeedback.startsWith("Denúncia") ? reportFeedback : "");
  useErrorToast(deleteServiceError);
  const [profilePreview, setProfilePreview] = useState<{
    userId: string;
    eyebrow: string;
    fallbackProfile: Partial<PublicUserProfile> & { fullName: string };
  } | null>(null);

  const visibleChats = chats.filter(
    (chat) =>
      chat.messages.length > 0 ||
      chat.id === activeChatId
  );
  const filteredChats = visibleChats.filter((chat) => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const lastMessage = getLastItem(chat.messages)?.text.toLowerCase() ?? "";

    return (
      !normalizedSearch ||
      chat.name.toLowerCase().includes(normalizedSearch) ||
      chat.role.toLowerCase().includes(normalizedSearch) ||
      lastMessage.includes(normalizedSearch)
    );
  });

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const isActiveServiceChat =
    Boolean(activeChat?.serviceRequestId) && activeServiceRequest?.chatId === activeChat?.id;
  const isPendingProviderContact =
    activeChat !== null && isPendingProviderContactRequest(activeChat, user?.accountKind);
  const isPendingClientContact =
    activeChat !== null && isPendingClientContactRequest(activeChat, user?.accountKind);
  const canStartServiceFromChat =
    activeChat !== null &&
    user?.accountKind === "client" &&
    isPostChat(activeChat) &&
    activeChat.messages.length > 0 &&
    isProviderChatRole(activeChat.role);
  const canSendChatImages =
    activeChat !== null &&
    user?.accountKind === "client" &&
    !isPendingProviderContact &&
    !isPendingClientContact;
  const activeChatDisplayName = activeChat ? getFirstNames(activeChat.name, 2) : "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length]);

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeChat || isSendingMessage) {
      return;
    }

    setIsSendingMessage(true);
    setMessageError("");
    const result = await sendMessage(activeChat.id, message);
    setIsSendingMessage(false);

    if (!result.ok) {
      setMessageError(result.error ?? "Não conseguimos enviar sua mensagem agora.");
      return;
    }

    setMessage("");
  };

  const handleSendImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file || !activeChat || isSendingImage) {
      return;
    }

    if (!canSendChatImages) {
      setMessageError("Apenas clientes podem enviar imagens no chat.");
      return;
    }

    setIsSendingImage(true);
    setMessageError("");

    try {
      const imageUrl = await readImageAsOptimizedDataUrl(file, {
        maxDimension: 960,
        quality: 0.76,
      });
      const result = await sendMessage(activeChat.id, {
        messageType: "image",
        imageUrl,
      });

      if (!result.ok) {
        setMessageError(result.error ?? "Não conseguimos enviar sua imagem agora.");
      }
    } catch (error) {
      setMessageError(
        error instanceof Error ? error.message : "Não conseguimos enviar sua imagem agora."
      );
    } finally {
      setIsSendingImage(false);
    }
  };

  const handleCloseDeal = () => {
    confirmServiceDeal();
    setIsClosingDealOpen(false);
    navigate("/app/service/details");
  };

  const handleStartServiceFromChat = async () => {
    if (!activeChat || isStartingService) {
      return;
    }

    setIsStartingService(true);
    setMessageError("");
    const result = await startServiceFromChat(activeChat.id);
    setIsStartingService(false);

    if (!result.ok) {
      setMessageError(result.error ?? "Não conseguimos fechar o serviço por este chat agora.");
      return;
    }

    navigate("/app/service/details");
  };

  const handleConfirmDetails = async () => {
    if (isConfirmingDetails) {
      return;
    }

    setIsConfirmingDetails(true);
    const result = await advanceServiceToPayment();
    setIsConfirmingDetails(false);

    if (!result.ok) {
      setMessageError(result.error ?? "Não conseguimos liberar o pagamento agora.");
      return;
    }

    setMessageError("");
  };

  const handleConfirmDetailsFromSummary = () => {
    setIsServiceSummaryOpen(false);
    void handleConfirmDetails();
  };

  const handleDeleteService = async () => {
    if (isDeletingService) {
      return;
    }

    setIsDeletingService(true);
    setDeleteServiceError("");
    const result = await deleteActiveServiceRequest();
    setIsDeletingService(false);

    if (!result.ok) {
      setDeleteServiceError(result.error ?? "Não conseguimos cancelar este serviço agora.");
      return;
    }

    setIsDeleteServiceOpen(false);
    setIsServiceSummaryOpen(false);
    navigate("/app/chat", { replace: true });
  };

  const handleSubmitReport = async () => {
    if (!activeChat || isReporting) {
      return;
    }

    setIsReporting(true);
    setReportFeedback("");
    const result = await reportChatConduct(activeChat.id, {
      reason: reportReason,
      details: reportDetails,
    });
    setIsReporting(false);

    if (!result.ok) {
      setReportFeedback(result.error ?? "Não conseguimos enviar a denúncia agora.");
      return;
    }

    setReportFeedback(result.message ?? "Denúncia enviada para análise.");
    setReportReason("");
    setReportDetails("");
    window.setTimeout(() => {
      setIsReportOpen(false);
      setReportFeedback("");
    }, 1200);
  };

  const handleRemoveChat = (chatId: string) => {
    setRevealedChatId(null);
    setChatDeleteConfirmationId(chatId);
  };

  const handleConfirmRemoveChat = () => {
    if (!chatDeleteConfirmationId) {
      return;
    }

    const chatId = chatDeleteConfirmationId;
    setChatDeleteConfirmationId(null);
    removeChatThread(chatId);
  };

  const chatDeleteConfirmation = chats.find((chat) => chat.id === chatDeleteConfirmationId) ?? null;

  const handleAcceptContactRequest = async () => {
    if (!activeChat || contactRequestAction) {
      return;
    }

    setContactRequestAction("accept");
    setMessageError("");
    const result = await sendMessage(
      activeChat.id,
      "Conversa aceita. Pode me contar mais detalhes por aqui."
    );
    setContactRequestAction(null);

    if (!result.ok) {
      setMessageError(result.error ?? "Não conseguimos aceitar a conversa agora.");
    }
  };

  const handleDeclineContactRequest = async () => {
    if (!activeChat || contactRequestAction) {
      return;
    }

    setContactRequestAction("decline");
    setMessageError("");
    const declinedChatId = activeChat.id;
    const result = await declineContactRequest(declinedChatId);
    setContactRequestAction(null);

    if (!result.ok) {
      setMessageError(result.error ?? "Não conseguimos recusar a conversa agora.");
      return;
    }

  };

  const handleOpenProfilePreview = (params: {
    userId?: string | null;
    eyebrow: string;
    fallbackProfile: Partial<PublicUserProfile> & { fullName: string };
  }) => {
    if (!params.userId) {
      return;
    }

    setProfilePreview({
      userId: params.userId,
      eyebrow: params.eyebrow,
      fallbackProfile: params.fallbackProfile,
    });
  };

  return (
    <div
      className="box-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-50 md:grid md:grid-cols-[340px_1fr]"
      style={{ paddingBottom: chatBottomInset }}
    >
      <section
        className={`min-h-0 min-w-0 flex-1 flex-col border-r border-neutral-100 bg-neutral-50 ${
          activeChat ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="shrink-0 bg-white px-5 pb-2 pt-6 sm:px-6">
          <h1 className="text-[22px] font-bold leading-tight text-neutral-900">
            Conversas
          </h1>

        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 custom-scrollbar sm:px-6">
          <div className="chat-search-shell mb-10 flex h-12 w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4">
            <Search className="h-4 w-4 flex-shrink-0 text-neutral-400" />
            <input
              type="text"
              placeholder="Pesquisar conversas..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="chat-search-input h-full w-full border-none bg-transparent text-[14px] text-neutral-700 outline-none placeholder:text-neutral-400"
            />
          </div>

          {filteredChats.length > 0 ? (
            filteredChats.map((chat, index) => {
              const lastMessage = getLastItem(chat.messages);
              const chatDisplayName = getFirstNames(chat.name, 2);

              return (
                <div
                  key={chat.id}
                  className="-mx-5 w-[calc(100%+2.5rem)] overflow-hidden sm:-mx-6 sm:w-[calc(100%+3rem)]"
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => handleRemoveChat(chat.id)}
                      className="absolute inset-y-2 right-5 flex w-20 items-center justify-center rounded-2xl bg-rose-600 text-white sm:right-6"
                      aria-label={`Excluir conversa com ${chat.name}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        x: revealedChatId === chat.id ? -88 : 0,
                      }}
                      transition={{ delay: index * 0.05 }}
                      drag="x"
                      dragConstraints={{ left: -96, right: 0 }}
                      dragElastic={0.08}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -72) {
                          handleRemoveChat(chat.id);
                          return;
                        }

                        setRevealedChatId(info.offset.x < -32 ? chat.id : null);
                      }}
                      onClick={() => {
                        if (revealedChatId === chat.id) {
                          setRevealedChatId(null);
                          return;
                        }

                        openChat(chat.id);
                      }}
                      className="group relative z-10 flex w-full items-center gap-3 bg-neutral-50 px-5 py-4 text-left transition-colors hover:bg-white sm:px-6"
                    >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenProfilePreview({
                        userId: chat.contactUserId,
                        eyebrow: "Perfil do contato",
                        fallbackProfile: {
                          fullName: chat.name,
                          accountKind: inferAccountKindFromChatRole(chat.role),
                          avatar: chat.avatar,
                          isCpfVerified: chat.isVerified,
                        },
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        handleOpenProfilePreview({
                          userId: chat.contactUserId,
                          eyebrow: "Perfil do contato",
                          fallbackProfile: {
                            fullName: chat.name,
                            accountKind: inferAccountKindFromChatRole(chat.role),
                            avatar: chat.avatar,
                            isCpfVerified: chat.isVerified,
                          },
                        });
                      }
                    }}
                    className="shrink-0 rounded-full"
                    aria-label={`Ver perfil de ${chat.name}`}
                  >
                    <ChatAvatar
                      name={chat.name}
                      avatar={chat.avatar}
                      accent={chat.accent}
                      isVerified={chat.isVerified}
                      size="list"
                      unread={chat.unread}
                    />
                  </div>

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="mb-0.5 flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                      <div className="min-w-0 flex flex-1 items-center">
                        <h3
                          title={chat.name}
                          className="font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors"
                        >
                          {chatDisplayName}
                        </h3>
                        <span className="ml-2 flex shrink-0 items-center">
                          <PresenceDot isOnline={chat.isOnline} />
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] sm:text-xs ${
                          chat.unread > 0 ? "text-blue-600 font-bold" : "text-slate-400"
                        }`}
                      >
                        {lastMessage?.timestamp ?? ""}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1 text-sm">
                      {lastMessage?.sender === "me" && (
                        <span className="shrink-0">
                          {lastMessage.status === "read" ? (
                            <CheckCheck className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Check className="w-4 h-4 text-slate-400" />
                          )}
                        </span>
                      )}
                      <p
                        className={`truncate ${
                          chat.unread > 0 ? "text-slate-800 font-medium" : "text-slate-500"
                        }`}
                      >
                        {lastMessage?.text ?? "Sem mensagens ainda"}
                      </p>
                    </div>
                  </div>

                  {chat.unread > 0 && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm">
                      {chat.unread}
                    </div>
                  )}
                    </motion.button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex min-h-[255px] flex-col items-center justify-center gap-4 px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                <MessageCircle className="h-7 w-7 text-blue-300" />
              </div>
              <h2 className="text-[15px] font-bold text-neutral-700">
                Nenhuma conversa encontrada
              </h2>
              <p className="max-w-[235px] text-center text-[13px] leading-relaxed text-neutral-400">
                Quando você contratar um(a) profissional, as mensagens aparecerão aqui.
              </p>
            </div>
          )}
        </div>
      </section>

      <section
        className={`min-h-0 min-w-0 flex-1 flex-col bg-slate-50 ${
          activeChat ? "flex" : "hidden md:flex"
        }`}
      >
        {activeChat ? (
          <>
            <div className="shrink-0 bg-white px-4 pb-4 pt-6 shadow-sm md:px-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={clearActiveChat}
                  className="md:hidden w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenProfilePreview({
                      userId: activeChat.contactUserId,
                      eyebrow: "Perfil do contato",
                      fallbackProfile: {
                        fullName: activeChat.name,
                        accountKind: inferAccountKindFromChatRole(activeChat.role),
                        avatar: activeChat.avatar,
                        isCpfVerified: activeChat.isVerified,
                      },
                    })
                  }
                  className="shrink-0 rounded-full"
                  aria-label={`Ver perfil de ${activeChat.name}`}
                >
                  <ChatAvatar
                    name={activeChat.name}
                    avatar={activeChat.avatar}
                    accent={activeChat.accent}
                    isVerified={activeChat.isVerified}
                    size="header"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center">
                    <h2 title={activeChat.name} className="font-bold text-slate-900 truncate">
                      {activeChatDisplayName}
                    </h2>
                    <span className="ml-2 flex shrink-0 items-center">
                      <PresenceDot isOnline={activeChat.isOnline} />
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{activeChat.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReportFeedback("");
                    setIsReportOpen(true);
                  }}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  aria-label={`Denunciar conversa com ${activeChat.name}`}
                >
                  <Flag className="h-4 w-4" />
                  <span className="hidden sm:inline">Denunciar</span>
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-semibold text-amber-900">
                  <span className="truncate">Chat monitorado</span>
                  <button
                    type="button"
                    onClick={() => setIsChatRulesOpen(true)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-white text-[13px] font-black leading-none text-amber-900 transition hover:bg-amber-100"
                    aria-label="Ver regras do chat monitorado"
                  >
                    ?
                  </button>
                </div>

                {canStartServiceFromChat && (
                  <button
                    type="button"
                    onClick={handleStartServiceFromChat}
                    disabled={isStartingService}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Handshake className="h-4 w-4" />
                    {isStartingService ? "Abrindo..." : "Fechar acordo"}
                  </button>
                )}
              </div>

              {isActiveServiceChat && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIsServiceSummaryOpen(true)}
                      className="inline-flex min-w-0 items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <span className="truncate">Ver detalhes</span>
                    </button>

                    <div className="ml-auto flex shrink-0 items-center">
                      {(activeServiceRequest?.status === "chatting" ||
                        activeServiceRequest?.status === "details") &&
                      activeServiceRequest.currentUserRole === "requester" ? (
                        <button
                          type="button"
                          onClick={() => setIsClosingDealOpen(true)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                          <Handshake className="h-4 w-4" />
                          Fechar acordo
                        </button>
                      ) : activeServiceRequest?.status === "waiting-worker" &&
                        activeServiceRequest.currentUserRole === "worker" ? (
                        <button
                          type="button"
                          onClick={handleConfirmDetails}
                          disabled={isConfirmingDetails}
                          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isConfirmingDetails ? "Confirmando..." : "Confirmar detalhes"}
                        </button>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-700">
                          {getActiveServiceStatusLabel(activeServiceRequest ?? null)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 custom-scrollbar md:px-6">
              {isPendingProviderContact ? (
                <div className="flex min-h-full items-center">
                  <div className="w-full rounded-[28px] bg-white p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
                      Solicitação de conversa
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenProfilePreview({
                            userId: activeChat.contactUserId,
                            eyebrow: "Perfil do cliente",
                            fallbackProfile: {
                              fullName: activeChat.name,
                              accountKind: "client",
                              avatar: activeChat.avatar,
                              isCpfVerified: activeChat.isVerified,
                            },
                          })
                        }
                        className="shrink-0 rounded-full"
                        aria-label={`Ver perfil de ${activeChat.name}`}
                      >
                        <ChatAvatar
                          name={activeChat.name}
                          avatar={activeChat.avatar}
                          accent={activeChat.accent}
                          isVerified={activeChat.isVerified}
                          size="header"
                        />
                      </button>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-slate-950">
                          {activeChatDisplayName}
                        </h3>
                        <p className="text-sm text-slate-500">Cliente quer conversar</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Perfil
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {activeChat.isVerified ? "Validado" : "Pendente"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          Avaliação
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">Sem nota ainda</p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-slate-500">
                      Aceite para liberar a conversa. Se recusar, o cliente será avisado.
                    </p>

                    {messageError && (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {messageError}
                      </div>
                    )}

                    <div className="mt-5 grid gap-3">
                      <button
                        type="button"
                        onClick={handleAcceptContactRequest}
                        disabled={contactRequestAction !== null}
                        className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {contactRequestAction === "accept" ? "Aceitando..." : "Aceitar conversa"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeclineContactRequest}
                        disabled={contactRequestAction !== null}
                        className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {contactRequestAction === "decline" ? "Recusando..." : "Recusar"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : isPendingClientContact ? (
                <div className="flex min-h-full items-center justify-center text-center">
                  <div className="max-w-[270px] rounded-[28px] bg-white p-5">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-950">
                      Aguardando resposta
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      O(a) prestador(a) recebeu sua solicitação de conversa. Você será avisado(a) quando houver resposta.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeChat.messages.map((chatMessage) => {
                    const fromMe = chatMessage.sender === "me";

                    return (
                      <div
                        key={chatMessage.id}
                        className={`flex ${fromMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`min-w-0 max-w-[82%] overflow-hidden rounded-3xl px-4 py-3 shadow-sm ${
                            fromMe
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-white text-slate-700 rounded-bl-md border border-slate-200"
                          }`}
                        >
                          {chatMessage.messageType === "image" && chatMessage.imageUrl ? (
                            <div className="space-y-2">
                              <img
                                src={chatMessage.imageUrl}
                                alt="Imagem enviada no chat"
                                className="max-h-72 w-full rounded-2xl object-cover"
                              />
                              {chatMessage.text && chatMessage.text !== "Imagem enviada" ? (
                                <p className="text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
                                  {chatMessage.text}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
                              {chatMessage.text}
                            </p>
                          )}
                          <div
                            className={`mt-2 flex items-center gap-1 text-[11px] ${
                              fromMe ? "text-blue-100" : "text-slate-400"
                            }`}
                          >
                            <span>{chatMessage.timestamp}</span>
                            {fromMe &&
                              (chatMessage.status === "read" ? (
                                <CheckCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            {!isPendingProviderContact && !isPendingClientContact && (
              <form
                onSubmit={handleSendMessage}
                className="shrink-0 bg-white px-4 py-4 md:px-6"
              >
                {messageError && (
                  <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {messageError}
                  </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleSendImage(event)}
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Escreva uma mensagem..."
                    className="chat-message-input w-full bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                  />
                  {canSendChatImages ? (
                    <>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isSendingImage || isSendingMessage}
                        className={`flex h-10 w-10 items-center justify-center bg-transparent text-blue-600 transition ${
                          isSendingImage || isSendingMessage
                            ? "cursor-not-allowed opacity-35"
                            : "opacity-100 active:scale-95"
                        }`}
                        aria-label="Enviar imagem"
                        title="Enviar imagem"
                      >
                        <Camera className="h-5 w-5" />
                      </button>
                      <span className="h-6 w-px shrink-0 bg-slate-200" aria-hidden="true" />
                    </>
                  ) : null}
                  <button
                    type="submit"
                    disabled={!message.trim() || isSendingMessage || isSendingImage}
                    className={`flex h-10 w-10 items-center justify-center bg-transparent text-blue-600 transition ${
                      message.trim() && !isSendingMessage && !isSendingImage
                        ? "opacity-100"
                        : "cursor-not-allowed opacity-35"
                    }`}
                  >
                    <SendHorizontal className="h-5 w-5" />
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <div className="hidden min-h-0 flex-1 items-center justify-center p-8 md:flex">
            <div className="max-w-sm text-center">
              <h2 className="text-2xl font-bold text-slate-900">Selecione uma conversa</h2>
            </div>
          </div>
        )}
      </section>

      {chatDeleteConfirmation && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/35 p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-chat-confirmation-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-600">
                  Excluir conversa
                </p>
                <h3
                  id="delete-chat-confirmation-title"
                  className="mt-2 text-xl font-bold leading-tight text-slate-950"
                >
                  Apagar conversa com {getFirstNames(chatDeleteConfirmation.name, 2)}?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setChatDeleteConfirmationId(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-slate-500 transition hover:bg-neutral-200"
                aria-label="Cancelar exclusão"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Essa conversa será removida da sua lista.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChatDeleteConfirmationId(null)}
                className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-neutral-200"
              >
                Não
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveChat}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700"
              >
                Sim, excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isChatRulesOpen && (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setIsChatRulesOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
                  Chat monitorado
                </p>
                <h3 className="mt-2 text-xl font-bold leading-tight text-slate-950">
                  Regras da conversa
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsChatRulesOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-slate-500 transition hover:bg-neutral-200"
                aria-label="Fechar regras do chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 text-sm leading-relaxed text-slate-600">
              <p>
                Converse apenas sobre o atendimento, valores, horários e detalhes necessários para o serviço.
              </p>
              <p>
                Clientes podem enviar imagens para mostrar o estado do serviço. Essas imagens também são monitoradas pela equipe Worko.
              </p>
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="font-bold text-slate-900">Não pode:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Enviar telefone, WhatsApp, e-mail, redes sociais ou links externos.</li>
                  <li>Combinar pagamento fora do Worko.</li>
                  <li>Ofender, ameaçar, assediar ou pressionar a outra pessoa.</li>
                  <li>Enviar imagens ofensivas, íntimas, ilegais, falsas ou sem relação com o serviço.</li>
                  <li>Enviar golpes, spam, conteúdo sexual, ilegal ou perigoso.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-800">
                Violações podem gerar bloqueio do chat, cancelamento do atendimento, suspensão da conta e análise da equipe Worko.
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {isReportOpen && activeChat && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-[30px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">
                  Denunciar conduta
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  Conte o que aconteceu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                disabled={isReporting}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
                aria-label="Fechar denúncia"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A denúncia será enviada para a equipe Worko com o contexto da conversa para análise e possível moderação.
            </p>

            <div className="mt-5 grid gap-2">
              {reportReasons.map((reason) => (
                <label
                  key={reason}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                    reportReason === reason
                      ? "border-rose-300 bg-rose-50 text-rose-900"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="chat-report-reason"
                    value={reason}
                    checked={reportReason === reason}
                    onChange={(event) => setReportReason(event.target.value)}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-medium">{reason}</span>
                </label>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="ml-1 text-sm font-semibold text-slate-700">
                Detalhes adicionais
              </span>
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Descreva o ocorrido, se quiser."
                className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
              />
            </label>

            {reportFeedback ? (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  reportFeedback.startsWith("Denúncia")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {reportFeedback}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={isReporting || !reportReason}
                className="rounded-[24px] bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isReporting ? "Enviando..." : "Enviar denúncia"}
              </button>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                disabled={isReporting}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isClosingDealOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-[30px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Confirmar acordo
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              Seguir com este(a) profissional?
            </h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCloseDeal}
                className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(37,99,235,0.18)] transition hover:bg-blue-700"
              >
                Continuar
              </button>
              <button
                type="button"
                onClick={() => setIsClosingDealOpen(false)}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Revisar conversa
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isServiceSummaryOpen && activeChat && (
        <div
          className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setIsServiceSummaryOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                  Detalhes do serviço
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {activeServiceRequest?.details?.title ||
                    activeChat.serviceType ||
                    "Serviço"}
                </h3>
                {activeServiceRequest?.details?.title ? (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {activeChat.serviceType ?? "Serviço"}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setIsServiceSummaryOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar detalhes do serviço"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {activeChat.servicePreview ?? "Sem descrição do serviço."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {activeChat.role}
              </span>
              <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {getActiveServiceStatusLabel(activeServiceRequest ?? null)}
              </span>
            </div>

            {activeServiceRequest?.details && (
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">
                    Acordo
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {activeServiceRequest.details.title || "Serviço combinado"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Valor
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {activeServiceRequest.details.price}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Data
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatServiceDate(activeServiceRequest.details.serviceDate, "medium") ||
                        "Não informada"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Horário
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {activeServiceRequest.details.schedule}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Tolerância
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatDelayTolerance(
                        activeServiceRequest.details.delayToleranceMinutes
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Local
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {getVisibleServiceLocation(activeServiceRequest)}
                  </p>
                </div>

                {["payment", "confirmed"].includes(activeServiceRequest.status) && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    <p className="font-semibold">
                      Pagamento protegido
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {activeServiceRequest?.currentUserRole === "requester" &&
              !["completed", "confirmed"].includes(activeServiceRequest?.status ?? "") ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteServiceError("");
                    setIsDeleteServiceOpen(true);
                  }}
                  className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <span className="inline-flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Cancelar serviço
                  </span>
                </button>
              ) : activeServiceRequest?.status === "waiting-worker" &&
                activeServiceRequest.currentUserRole === "worker" ? (
                <button
                  type="button"
                  onClick={handleConfirmDetailsFromSummary}
                  disabled={isConfirmingDetails}
                  className="rounded-[24px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isConfirmingDetails ? "Confirmando..." : "Confirmar detalhes"}
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}

      {isDeleteServiceOpen && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-[30px] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">
              Cancelar serviço
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              Apagar este serviço por completo?
            </h3>
            {deleteServiceError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {deleteServiceError}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDeleteService}
                disabled={isDeletingService}
                className="rounded-[24px] bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDeletingService ? "Apagando..." : "Cancelar serviço"}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteServiceOpen(false)}
                disabled={isDeletingService}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Voltar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <PublicProfileModal
        isOpen={Boolean(profilePreview)}
        userId={profilePreview?.userId ?? null}
        eyebrow={profilePreview?.eyebrow}
        fallbackProfile={profilePreview?.fallbackProfile}
        onClose={() => setProfilePreview(null)}
      />
    </div>
  );
}

