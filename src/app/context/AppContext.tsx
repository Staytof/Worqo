import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiRequestError, apiRequest, dispatchSystemStatus } from "../api/client";
import { seedChats, seedPins, seedPosts } from "../data/seed";
import { deliverNativeNotifications } from "../lib/nativeNotifications";
import { getDeviceIdentity } from "../lib/deviceIdentity";
import { isNativeAppRuntime } from "../lib/nativeRuntime";
import { unregisterNativePushDevice } from "../lib/pushNotifications";
import {
  applyThemePreference,
  normalizeThemePreference,
  persistThemePreference,
  readThemePreference,
} from "../lib/theme";
import type {
  AppNotification,
  ActiveServiceRequest,
  AppState,
  ChatThread,
  LoginPayload,
  PendingDeviceVerification,
  PendingVerification,
  Post,
  PostComposerPayload,
  RegistrationDraft,
  ServiceDetailsPayload,
  ServiceReview,
  ServiceReviewPayload,
  ServicePin,
  ServiceRequestStatus,
  ServiceRequestComposerPayload,
  ServiceDispute,
  ServicePaymentSnapshot,
  ServiceTimelineEvent,
  UserProfile,
} from "../types";
import {
  formatCurrencyInput,
  formatCpf,
  formatDelayTolerance,
  formatScheduleInput,
  formatServiceDate,
  isValidCpf,
} from "../utils/helpers";
import {
  CHAT_EXTERNAL_CONTACT_WARNING,
  containsExternalContact,
} from "../utils/chatGuard";

const STORAGE_KEY = "worqo-react-app-state-v5";
const LEGACY_STORAGE_KEY = "worqo-react-app-state-v4";
const LEGACY_PIN_IDS = new Set([
  "pin-carlos",
  "pin-maria",
  "pin-pedro",
  "pin-joao",
  "pin-samuel-eletrica",
  "pin-lucia-limpeza",
  "pin-caio-tecnico",
]);
const LEGACY_POST_IDS = new Set([
  "post-carlos",
  "post-maria",
  "post-pedro",
  "post-ana",
  "post-samuel-eletrica",
  "post-lucia-limpeza",
  "post-caio-tecnico",
]);
const LEGACY_CHAT_IDS = new Set([
  "chat-carlos",
  "chat-maria",
  "chat-pedro",
  "chat-joao",
  "chat-samuel-eletrica",
  "chat-lucia-limpeza",
  "chat-caio-tecnico",
]);
const SEED_PIN_MAP = new Map(seedPins.map((pin) => [pin.id, pin]));
const SEED_POST_MAP = new Map(seedPosts.map((post) => [post.id, post]));
const SEED_CHAT_MAP = new Map(seedChats.map((chat) => [chat.id, chat]));
const LOCAL_REQUESTER_INTERIM_STATUSES = new Set<ServiceRequestStatus>(["interest-received", "details"]);
const MAX_STORED_NOTIFICATIONS = 50;
const DEFAULT_REQUEST_MASK_RADIUS_METERS = 150;

type Result = {
  ok: boolean;
  error?: string;
  message?: string;
  user?: UserProfile;
  post?: Post;
  requiresVerification?: boolean;
  requiresDeviceVerification?: boolean;
};

type ChatMessagePayload = {
  text?: string;
  body?: string;
  messageType?: "text" | "image";
  imageUrl?: string;
};

type SessionResponse = {
  token: string | null;
  user: UserProfile | null;
  requiresDeviceVerification?: boolean;
  pendingDeviceVerification?: PendingDeviceVerification;
};

type RemoteServiceRequest = {
  id: string;
  type: ServicePin["type"];
  requesterId: string;
  requesterName: string;
  requesterVerified: boolean;
  description: string;
  latitude: number;
  longitude: number;
  maskedLatitude?: number;
  maskedLongitude?: number;
  maskedRadiusMeters?: number;
  exactLocationVisible?: boolean;
  accuracy: number | null;
  locationLabel: string | null;
  status: ServicePin["status"];
  currentUserRole?: "requester" | "worker";
  workerId?: string | null;
  workerName?: string | null;
  workerVerified?: boolean;
  acceptedAt?: string | null;
  chatId?: string | null;
  payment?: ServicePaymentSnapshot | null;
  dispute?: ServiceDispute | null;
  noShowEligibleAt?: string | null;
  canReportNoShow?: boolean;
  timeline?: ServiceTimelineEvent[];
  details?: ActiveServiceRequest["details"];
  createdAt: string;
  updatedAt: string;
};

type AcceptWorkerResult = Result & {
  chatId?: string;
  requestSent?: boolean;
};

type ServicePaymentSessionResult = Result & {
  paymentId?: string;
  paymentStatus?: string;
  invoiceUrl?: string | null;
  dueDate?: string | null;
  pixCopyPaste?: string | null;
  pixQrCodeBase64?: string | null;
  expiresAt?: string | null;
};

type CompletedServiceRequestsResult = Result & {
  requests?: ActiveServiceRequest[];
};

type AppContextValue = {
  state: AppState;
  login: (payload: LoginPayload) => Promise<Result>;
  completeGoogleLogin: (payload: {
    token?: string;
    pendingVerification?: PendingVerification;
    pendingDeviceVerification?: PendingDeviceVerification;
    rememberMe?: boolean;
  }) => Promise<Result>;
  verifyDeviceLogin: (code: string) => Promise<Result>;
  cancelDeviceVerification: () => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<Result>;
  register: (payload: RegistrationDraft) => Promise<Result>;
  requestVerificationCode: () => Promise<Result>;
  completeVerification: (payload: {
    code: string;
    acceptTerms: boolean;
    acceptPrivacy: boolean;
    legalVersion: string;
  }) => Promise<Result>;
  finishProfileSetup: (avatar: string) => Promise<Result>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<Result>;
  submitProviderVerification: (payload: {
    cpf: string;
    rgNumber: string;
    faceImage: string;
    rgDocumentImage: string;
  }) => Promise<Result>;
  verifyCpf: (cpf: string) => Promise<Result>;
  addPost: (payload: PostComposerPayload) => Promise<Result>;
  removePost: (postId: string) => Promise<Result>;
  createServiceRequest: (payload: ServiceRequestComposerPayload) => Promise<Result>;
  takeServiceRequest: (requestId: string) => Promise<Result>;
  refreshServicePins: () => Promise<Result>;
  acceptWorkerInterest: () => Promise<AcceptWorkerResult>;
  declineWorkerInterest: (options?: { blockWorkerForTenMinutes?: boolean }) => Promise<Result>;
  confirmServiceDeal: () => void;
  submitServiceDetails: (payload: ServiceDetailsPayload) => Promise<Result>;
  advanceServiceToPayment: () => Promise<Result>;
  createServicePaymentSession: () => Promise<ServicePaymentSessionResult>;
  refreshServicePaymentStatus: () => Promise<Result>;
  cancelActiveServiceRequest: () => Promise<Result>;
  deleteActiveServiceRequest: () => Promise<Result>;
  markServicePaid: () => Promise<Result>;
  markWorkerArrived: () => Promise<Result>;
  openServiceDispute: (reason: string) => Promise<Result>;
  reportProviderNoShow: (payload: {
    reason: string;
    evidenceImage?: string | null;
  }) => Promise<Result>;
  respondProviderNoShow: (payload: {
    response: string;
    acknowledgesNoShow: boolean;
  }) => Promise<Result>;
  releaseServicePayment: (payload: ServiceReviewPayload) => Promise<Result>;
  listCompletedServiceRequests: () => Promise<CompletedServiceRequestsResult>;
  refreshSessionState: () => Promise<Result>;
  completeAppTour: () => Promise<Result>;
  dismissNotification: (notificationId: string) => void;
  removeNotification: (notificationId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearReadNotifications: () => void;
  openChat: (chatId: string) => void;
  openChatFromPost: (postId: string) => Promise<AcceptWorkerResult>;
  startServiceFromChat: (chatId: string) => Promise<AcceptWorkerResult>;
  clearActiveChat: () => void;
  declineContactRequest: (chatId: string) => Promise<Result>;
  reopenChat: (chatId: string) => Promise<Result>;
  removeChatThread: (chatId: string) => void;
  reportChatConduct: (chatId: string, payload: { reason: string; details?: string }) => Promise<Result>;
  sendMessage: (chatId: string, message: string | ChatMessagePayload) => Promise<Result>;
};

const AppContext = createContext<AppContextValue | null>(null);

function createInitialState(): AppState {
  return {
    authReady: false,
    onboardingStep: "login",
    isAuthenticated: false,
    rememberSession: true,
    themePreference: readThemePreference(),
    sessionToken: null,
    pendingVerification: null,
    pendingDeviceVerification: null,
    user: null,
    pins: seedPins,
    posts: seedPosts,
    chats: seedChats,
    notifications: [],
    activeChatId: null,
    activeServiceRequest: null,
  };
}

function readPersistedStateRaw() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.sessionStorage.getItem(STORAGE_KEY) ??
    window.localStorage.getItem(STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_STORAGE_KEY)
  );
}

function clearPersistedStateStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function hydrateServiceReviews(reviews: Partial<ServiceReview>[] | null | undefined): ServiceReview[] {
  if (!Array.isArray(reviews)) {
    return [];
  }

  return reviews.map((review) => ({
    id: review.id ?? "",
    rating: Number(review.rating) || 0,
    comment: review.comment ?? "",
    reviewerId: review.reviewerId ?? "",
    reviewerName: review.reviewerName ?? "Cliente",
    reviewerAvatar: review.reviewerAvatar ?? null,
    serviceTitle: review.serviceTitle ?? "Atendimento Worko",
    createdAt: review.createdAt ?? "",
  }));
}

function hydrateUserProfile(user: Partial<UserProfile> | null | undefined): UserProfile | null {
  if (!user) {
    return null;
  }

  const profile: UserProfile = {
    id: user.id ?? "",
    fullName: user.fullName ?? "",
    email: user.email ?? "",
    accountKind:
      user.accountKind === "client" || user.accountKind === "provider" ? user.accountKind : null,
    phone: user.phone ?? "",
    birthDate: user.birthDate ?? "",
    avatar: user.avatar ?? null,
    headline: user.headline ?? "",
    bio: user.bio ?? "",
    professions: user.professions ?? [],
    skills: user.skills ?? [],
    availabilityNote: user.availabilityNote ?? "",
    cpf: user.cpf ?? "",
    address: user.address ?? "",
    certificates: user.certificates ?? [],
    isAccountVerified: Boolean(user.isAccountVerified),
    isCpfVerified: Boolean(user.isCpfVerified),
    cpfVerifiedAt: user.cpfVerifiedAt ?? null,
    cpfVerificationProvider: user.cpfVerificationProvider ?? null,
    termsAcceptedAt: user.termsAcceptedAt ?? null,
    privacyAcceptedAt: user.privacyAcceptedAt ?? null,
    legalAcceptedVersion: user.legalAcceptedVersion ?? null,
    verifiedChannel: user.verifiedChannel ?? null,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    appTourCompletedAt: user.appTourCompletedAt ?? null,
    hasCompletedProfileSetup: Boolean(user.hasCompletedProfileSetup),
    providerVerificationStatus: user.providerVerificationStatus ?? "not_required",
    providerVerificationSubmittedAt: user.providerVerificationSubmittedAt ?? null,
    providerVerificationRequestedReason: user.providerVerificationRequestedReason ?? null,
    providerVerificationDecisionNote: user.providerVerificationDecisionNote ?? null,
    providerVerificationDocumentVersion: user.providerVerificationDocumentVersion ?? 0,
    providerVerificationHasDocuments: Boolean(user.providerVerificationHasDocuments),
    pixKeyType: user.pixKeyType ?? null,
    pixKey: user.pixKey ?? "",
    hasPixKeyConfigured: Boolean(user.hasPixKeyConfigured),
    canReceivePixTransfers: Boolean(user.canReceivePixTransfers),
    isAdmin: Boolean(user.isAdmin),
    isSuspended: Boolean(user.isSuspended),
    suspendedAt: user.suspendedAt ?? null,
    suspensionReason: user.suspensionReason ?? null,
    identityLockedAt: user.identityLockedAt ?? null,
    completedServicesCount: user.completedServicesCount ?? 0,
    averageRating:
      typeof user.averageRating === "number" ? user.averageRating : user.averageRating ?? null,
    reviewsCount: user.reviewsCount ?? 0,
    recentReviews: hydrateServiceReviews(user.recentReviews),
    createdAt: user.createdAt ?? "",
  };

  return profile;
}

function hydratePin(pin: ServicePin): ServicePin {
  const seedPin = SEED_PIN_MAP.get(pin.id);
  const latitude = pin.latitude ?? seedPin?.latitude ?? 0;
  const longitude = pin.longitude ?? seedPin?.longitude ?? 0;

  return {
    ...(seedPin ?? pin),
    ...pin,
    isVerified: pin.isVerified ?? seedPin?.isVerified ?? false,
    latitude,
    longitude,
    maskedLatitude: pin.maskedLatitude ?? latitude,
    maskedLongitude: pin.maskedLongitude ?? longitude,
    maskedRadiusMeters:
      pin.maskedRadiusMeters ?? seedPin?.maskedRadiusMeters ?? DEFAULT_REQUEST_MASK_RADIUS_METERS,
    exactLocationVisible: Boolean(pin.exactLocationVisible),
  };
}

function hydratePost(post: Post): Post {
  const seedPost = SEED_POST_MAP.get(post.id);
  const durationDays = post.durationDays ?? seedPost?.durationDays ?? null;
  const latitude = post.latitude ?? seedPost?.latitude ?? null;
  const longitude = post.longitude ?? seedPost?.longitude ?? null;

  return {
    ...(seedPost ?? post),
    ...post,
    isVerified: post.isVerified ?? seedPost?.isVerified ?? false,
    profession: post.profession ?? seedPost?.profession ?? "",
    experience: post.experience ?? post.content ?? seedPost?.experience ?? "",
    durationDays: durationDays === null ? null : Number(durationDays),
    expiresAt: post.expiresAt ?? seedPost?.expiresAt ?? null,
    latitude: latitude === null ? null : Number(latitude),
    longitude: longitude === null ? null : Number(longitude),
    avatar: post.avatar ?? seedPost?.avatar ?? null,
  };
}

function isActivePost(post: Post) {
  if (!post.expiresAt) {
    return true;
  }

  const expiresAt = new Date(post.expiresAt).getTime();

  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function hydrateChat(chat: ChatThread): ChatThread {
  const seedChat = SEED_CHAT_MAP.get(chat.id);

  return {
    ...(seedChat ?? chat),
    ...chat,
    avatar: chat.avatar ?? seedChat?.avatar ?? null,
    contactUserId: chat.contactUserId ?? seedChat?.contactUserId ?? null,
    updatedAt: chat.updatedAt ?? seedChat?.updatedAt ?? null,
    isOnline: chat.isOnline ?? seedChat?.isOnline ?? false,
    isVerified: chat.isVerified ?? seedChat?.isVerified ?? false,
    serviceRequestId: chat.serviceRequestId ?? seedChat?.serviceRequestId ?? null,
    serviceType: chat.serviceType ?? seedChat?.serviceType ?? null,
    servicePreview: chat.servicePreview ?? seedChat?.servicePreview ?? null,
    serviceStatus: chat.serviceStatus ?? seedChat?.serviceStatus ?? null,
    isLocked: chat.isLocked ?? seedChat?.isLocked ?? false,
    messages: (chat.messages ?? []).map((message) => ({
      ...message,
      messageType: message.messageType === "image" && message.imageUrl ? "image" : "text",
      imageUrl: message.messageType === "image" ? message.imageUrl ?? null : null,
    })),
  };
}

function isServerBackedChat(chat: ChatThread | null | undefined): chat is ChatThread {
  return Boolean(chat && (chat.serviceRequestId || chat.contactUserId));
}

function hydrateState(): AppState {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  try {
    const rawState = readPersistedStateRaw();

    if (!rawState) {
      return createInitialState();
    }

    const parsed = JSON.parse(rawState) as Partial<AppState>;
    const initial = createInitialState();
    const sanitizedPins = (parsed.pins ?? [])
      .filter((pin) => !LEGACY_PIN_IDS.has(pin.id))
      .map(hydratePin);
    const sanitizedPosts = (parsed.posts ?? [])
      .filter((post) => !LEGACY_POST_IDS.has(post.id))
      .map(hydratePost);
    const sanitizedChats = (parsed.chats ?? [])
      .filter((chat) => !LEGACY_CHAT_IDS.has(chat.id))
      .map(hydrateChat)
      .filter(isServerBackedChat);
    const sanitizedNotifications = (parsed.notifications ?? [])
      .map(hydrateNotification)
      .filter((notification): notification is AppNotification => Boolean(notification))
      .slice(-MAX_STORED_NOTIFICATIONS);
    const sanitizedActiveServiceRequest = parsed.activeServiceRequest
      ? {
          ...parsed.activeServiceRequest,
          createdAt:
            parsed.activeServiceRequest.createdAt ?? new Date().toISOString(),
          createdAtLabel: buildCreatedAtLabel(
            parsed.activeServiceRequest.createdAt ?? new Date().toISOString()
          ),
          currentUserRole: parsed.activeServiceRequest.currentUserRole ?? "requester",
          requesterId: parsed.activeServiceRequest.requesterId ?? parsed.user?.id ?? "",
          requesterName:
            parsed.activeServiceRequest.requesterName ?? parsed.user?.fullName ?? "",
          requesterVerified: Boolean(parsed.activeServiceRequest.requesterVerified),
          latitude: parsed.activeServiceRequest.latitude ?? 0,
          longitude: parsed.activeServiceRequest.longitude ?? 0,
          maskedLatitude:
            parsed.activeServiceRequest.maskedLatitude ??
            parsed.activeServiceRequest.latitude ??
            0,
          maskedLongitude:
            parsed.activeServiceRequest.maskedLongitude ??
            parsed.activeServiceRequest.longitude ??
            0,
          maskedRadiusMeters:
            parsed.activeServiceRequest.maskedRadiusMeters ??
            DEFAULT_REQUEST_MASK_RADIUS_METERS,
          exactLocationVisible:
            parsed.activeServiceRequest.exactLocationVisible ??
            parsed.activeServiceRequest.currentUserRole === "requester",
          workerId: parsed.activeServiceRequest.workerId ?? null,
          workerName: parsed.activeServiceRequest.workerName ?? null,
          workerVerified: Boolean(parsed.activeServiceRequest.workerVerified),
          acceptedAt: parsed.activeServiceRequest.acceptedAt ?? null,
          chatId: parsed.activeServiceRequest.chatId ?? null,
          dismissedWorkerIds: parsed.activeServiceRequest.dismissedWorkerIds ?? [],
          payment: hydrateServicePayment(parsed.activeServiceRequest.payment),
          dispute: hydrateServiceDispute(parsed.activeServiceRequest.dispute),
          timeline: hydrateServiceTimeline(parsed.activeServiceRequest.timeline),
          details: hydrateServiceDetails(parsed.activeServiceRequest.details),
        }
      : null;
    const activeChatId =
      parsed.activeChatId && sanitizedChats.some((chat) => chat.id === parsed.activeChatId)
        ? parsed.activeChatId
        : null;

    return {
      ...initial,
      ...parsed,
      authReady: false,
      isAuthenticated: false,
      rememberSession: parsed.rememberSession ?? true,
      themePreference: normalizeThemePreference(parsed.themePreference ?? initial.themePreference),
      sessionToken: parsed.sessionToken ?? null,
      pendingVerification: parsed.pendingVerification ?? null,
      pendingDeviceVerification: parsed.pendingDeviceVerification ?? null,
      user: hydrateUserProfile(parsed.user),
      pins: sanitizedPins.length ? sanitizedPins : initial.pins,
      posts: sanitizedPosts.length ? sanitizedPosts : initial.posts,
      chats: sanitizedChats.length ? sanitizedChats : initial.chats,
      notifications: sanitizedNotifications,
      activeChatId,
      activeServiceRequest: sanitizedActiveServiceRequest,
    };
  } catch {
    return createInitialState();
  }
}

function nowLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function buildCreatedAtLabel(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(createdAt));
}

function nowIso() {
  return new Date().toISOString();
}

function hydrateNotification(
  notification: Partial<AppNotification> | null | undefined
): AppNotification | null {
  if (!notification?.id || !notification.message || !notification.kind || !notification.createdAt) {
    return null;
  }

  return {
    id: notification.id,
    kind: notification.kind,
    message: notification.message,
    title: notification.title ?? null,
    avatar: notification.avatar ?? null,
    chatId: notification.chatId ?? null,
    createdAt: notification.createdAt,
    readAt: notification.readAt ?? null,
    toastDismissedAt: notification.toastDismissedAt ?? null,
  };
}

function resolveServiceRequestApiError(
  error: unknown,
  fallbackMessage: string
) {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (error.message === "Rota não encontrada.") {
    return "O servidor local do mapa está desatualizado. Reinicie o app para aplicar as novas rotas.";
  }

  return error.message;
}

function mapRemoteServicePin(request: RemoteServiceRequest): ServicePin {
  return {
    id: request.id,
    type: request.type,
    requesterId: request.requesterId,
    requesterName: request.requesterName,
    isVerified: Boolean(request.requesterVerified),
    description: request.description,
    latitude: request.latitude,
    longitude: request.longitude,
    maskedLatitude: request.maskedLatitude ?? request.latitude,
    maskedLongitude: request.maskedLongitude ?? request.longitude,
    maskedRadiusMeters:
      request.maskedRadiusMeters ?? DEFAULT_REQUEST_MASK_RADIUS_METERS,
    exactLocationVisible: Boolean(request.exactLocationVisible),
    accuracy: request.accuracy ?? null,
    locationLabel: request.locationLabel ?? null,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function hydrateServiceDetails(
  details: ActiveServiceRequest["details"] | undefined | null
): ActiveServiceRequest["details"] {
  if (!details) {
    return null;
  }

  return {
    title: String(details.title ?? "").trim(),
    price: formatCurrencyInput(details.price ?? ""),
    serviceDate: details.serviceDate ?? "",
    schedule: formatScheduleInput(details.schedule ?? ""),
    delayToleranceMinutes:
      Number.isFinite(Number(details.delayToleranceMinutes)) &&
      Number(details.delayToleranceMinutes) >= 0
        ? Math.round(Number(details.delayToleranceMinutes))
        : 15,
    locationMode: details.locationMode === "street" ? "street" : "residence",
    address: details.address ?? "",
    latitude:
      Number.isFinite(Number(details.latitude)) ? Number(details.latitude) : null,
    longitude:
      Number.isFinite(Number(details.longitude)) ? Number(details.longitude) : null,
    accuracy:
      details.accuracy === null || details.accuracy === undefined
        ? null
        : Number.isFinite(Number(details.accuracy))
          ? Number(details.accuracy)
          : null,
    locationLabel: details.locationLabel ?? null,
  };
}

function hydrateServicePayment(
  payment: ServicePaymentSnapshot | undefined | null
): ServicePaymentSnapshot | null {
  if (!payment) {
    return null;
  }

  return {
    subtotalCents: Number(payment.subtotalCents) || 0,
    feeCents: Number(payment.feeCents) || 0,
    totalCents: Number(payment.totalCents) || 0,
    currency: payment.currency ?? "brl",
    providerStatus: payment.providerStatus ?? null,
    receivedAt: payment.receivedAt ?? null,
  };
}

function hydrateServiceDispute(
  dispute: ServiceDispute | undefined | null
): ServiceDispute | null {
  if (!dispute || !dispute.status) {
    return null;
  }

  return {
    status: dispute.status,
    kind: dispute.kind === "provider-no-show" ? "provider-no-show" : "general",
    reason: dispute.reason ?? "",
    openedAt: dispute.openedAt ?? null,
    openedByUserId: dispute.openedByUserId ?? null,
    evidenceImage: dispute.evidenceImage ?? null,
    providerResponse: dispute.providerResponse ?? null,
    providerRespondedAt: dispute.providerRespondedAt ?? null,
    providerAcknowledgedNoShow: Boolean(dispute.providerAcknowledgedNoShow),
    responseDueAt: dispute.responseDueAt ?? null,
    resolution: dispute.resolution ?? null,
    resolvedAt: dispute.resolvedAt ?? null,
    adminNote: dispute.adminNote ?? null,
  };
}

function hydrateServiceTimeline(
  timeline: ServiceTimelineEvent[] | undefined | null
): ServiceTimelineEvent[] {
  if (!Array.isArray(timeline)) {
    return [];
  }

  return timeline
    .filter((event) => event && event.id && event.title && event.createdAt)
    .map((event) => ({
      id: event.id,
      kind: event.kind ?? "event",
      actorRole:
        event.actorRole === "requester" ||
        event.actorRole === "worker" ||
        event.actorRole === "admin"
          ? event.actorRole
          : "system",
      title: event.title,
      description: event.description ?? "",
      createdAt: event.createdAt,
    }));
}

function resolveLocalServiceStatus(
  request: RemoteServiceRequest,
  previousRequest: ActiveServiceRequest | null
): ServiceRequestStatus {
  const currentUserRole = request.currentUserRole ?? previousRequest?.currentUserRole ?? "requester";

  if (
    previousRequest?.id === request.id &&
    currentUserRole === "requester" &&
    LOCAL_REQUESTER_INTERIM_STATUSES.has(previousRequest.status) &&
    previousRequest.status === "details" &&
    request.status === "chatting"
  ) {
    return previousRequest.status;
  }

  if (
    previousRequest?.id === request.id &&
    currentUserRole === "requester" &&
    LOCAL_REQUESTER_INTERIM_STATUSES.has(previousRequest.status) &&
    previousRequest.status === "interest-received" &&
    request.status === "assigned"
  ) {
    return previousRequest.status;
  }

  if (currentUserRole === "requester" && request.status === "assigned") {
    return "interest-received";
  }

  return request.status;
}

function mapRemoteActiveServiceRequest(
  request: RemoteServiceRequest,
  previousRequest: ActiveServiceRequest | null = null
): ActiveServiceRequest {
  const shouldReuseEphemeralState = previousRequest?.id === request.id;

  return {
    id: request.id,
    type: request.type,
    description: request.description,
    createdAt: request.createdAt,
    createdAtLabel: buildCreatedAtLabel(request.createdAt),
    status: resolveLocalServiceStatus(request, previousRequest),
    currentUserRole: request.currentUserRole ?? "requester",
    requesterId: request.requesterId,
    requesterName: request.requesterName,
    requesterVerified: Boolean(request.requesterVerified),
    latitude: request.latitude,
    longitude: request.longitude,
    maskedLatitude: request.maskedLatitude ?? request.latitude,
    maskedLongitude: request.maskedLongitude ?? request.longitude,
    maskedRadiusMeters:
      request.maskedRadiusMeters ?? DEFAULT_REQUEST_MASK_RADIUS_METERS,
    exactLocationVisible: Boolean(request.exactLocationVisible),
    accuracy: request.accuracy ?? null,
    locationLabel: request.locationLabel ?? null,
    workerId: request.workerId ?? null,
    workerName: request.workerName ?? null,
    workerVerified: Boolean(request.workerVerified),
    acceptedAt: request.acceptedAt ?? null,
    chatId:
      request.chatId ?? (shouldReuseEphemeralState ? previousRequest.chatId : null) ?? null,
    dismissedWorkerIds: shouldReuseEphemeralState
      ? previousRequest.dismissedWorkerIds
      : [],
    payment: hydrateServicePayment(
      request.payment ?? (shouldReuseEphemeralState ? previousRequest.payment : null)
    ),
    dispute: hydrateServiceDispute(
      request.dispute ?? (shouldReuseEphemeralState ? previousRequest.dispute : null)
    ),
    noShowEligibleAt: request.noShowEligibleAt ?? null,
    canReportNoShow: Boolean(request.canReportNoShow),
    timeline: hydrateServiceTimeline(
      request.timeline ?? (shouldReuseEphemeralState ? previousRequest.timeline : [])
    ),
    details: hydrateServiceDetails(
      request.details ?? (shouldReuseEphemeralState ? previousRequest.details : null)
    ),
  };
}

async function loadRemotePins(token: string) {
  const response = await apiRequest<{ requests: RemoteServiceRequest[] }>("/api/service-requests", {
    token,
  });

  return response.requests.map(mapRemoteServicePin);
}

async function loadRemoteActiveServiceRequest(token: string) {
  const response = await apiRequest<{ request: RemoteServiceRequest | null }>(
    "/api/service-requests/active",
    {
      token,
    }
  );

  return response.request;
}

async function loadRemoteSessionUser(token: string) {
  const response = await apiRequest<{ user: UserProfile }>("/api/auth/session", {
    token,
  });

  return response.user;
}

async function loadRemoteChats(token: string) {
  const response = await apiRequest<{ chats: ChatThread[] }>("/api/chats", {
    token,
  });

  return response.chats.map(hydrateChat);
}

async function loadRemotePosts(token: string) {
  const response = await apiRequest<{ posts: Post[] }>("/api/posts", {
    token,
  });

  return response.posts.map(hydratePost).filter(isActivePost);
}

async function safelyLoadRemoteChats(token: string) {
  try {
    return await loadRemoteChats(token);
  } catch {
    return null;
  }
}

async function consumeRemoteNotifications(token: string) {
  const response = await apiRequest<{
    notifications: Array<
      Pick<AppNotification, "id" | "kind" | "message" | "createdAt" | "title" | "avatar" | "chatId">
    >;
  }>(
    "/api/notifications/consume",
    {
      method: "POST",
      token,
    }
  );

  return response.notifications
    .map((notification) =>
      hydrateNotification({
        ...notification,
        readAt: null,
        toastDismissedAt: null,
      })
    )
    .filter((notification): notification is AppNotification => Boolean(notification));
}

function mergeNotifications(
  currentNotifications: AppNotification[],
  incomingNotifications: AppNotification[]
) {
  if (incomingNotifications.length === 0) {
    return currentNotifications;
  }

  const mergedById = new Map(currentNotifications.map((notification) => [notification.id, notification]));

  for (const incoming of incomingNotifications) {
    const current = mergedById.get(incoming.id);

    mergedById.set(incoming.id, {
      ...incoming,
      readAt: current?.readAt ?? incoming.readAt ?? null,
      toastDismissedAt: current?.toastDismissedAt ?? incoming.toastDismissedAt ?? null,
    });
  }

  return Array.from(mergedById.values())
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(-MAX_STORED_NOTIFICATIONS);
}

function updateChatList(
  chats: ChatThread[],
  chatId: string,
  updater: (chat: ChatThread) => ChatThread
) {
  return chats.map((chat) => (chat.id === chatId ? updater(chat) : chat));
}

function upsertChatList(chats: ChatThread[], nextChat: ChatThread) {
  return [nextChat, ...chats.filter((chat) => chat.id !== nextChat.id)];
}

function hasChatMessages(chat: ChatThread) {
  return chat.messages.length > 0;
}

function shouldKeepChatInState(chat: ChatThread, activeChatId: string | null = null) {
  return hasChatMessages(chat) || chat.id === activeChatId;
}

function mergeRemoteChats(
  currentChats: ChatThread[],
  remoteChats: ChatThread[] | null,
  activeChatId: string | null = null
) {
  if (!remoteChats) {
    return currentChats.filter(
      (chat) => isServerBackedChat(chat) && shouldKeepChatInState(chat, activeChatId)
    );
  }

  const visibleRemoteChats = remoteChats.filter(
    (chat) => isServerBackedChat(chat) && shouldKeepChatInState(chat, activeChatId)
  );

  return visibleRemoteChats;
}

function resolveLoggedOutStep(current: AppState) {
  if (current.pendingDeviceVerification) {
    return "device-verify";
  }

  return current.pendingVerification ? "verify" : "login";
}

function isProviderVerificationLocked(user: UserProfile | null | undefined) {
  return Boolean(
    user?.accountKind === "provider" && user.providerVerificationStatus !== "approved"
  );
}

function resolveAuthenticatedStep(user: UserProfile | null | undefined) {
  if (user?.isAdmin) {
    return "app";
  }

  if (!user?.hasCompletedProfileSetup) {
    return "profile-setup";
  }

  if (user.accountKind === "provider") {
    if (
      user.providerVerificationStatus === "pending_documents" ||
      user.providerVerificationStatus === "changes_requested"
    ) {
      return "provider-verification";
    }

    if (user.providerVerificationStatus !== "approved") {
      return "provider-review";
    }
  }

  return "app";
}

function createEmptyRemoteAppState() {
  return {
    pins: [] as ServicePin[],
    posts: [] as Post[],
    activeServiceRequest: null as ActiveServiceRequest | null,
    chats: [] as ChatThread[],
  };
}

function resolveCreateServiceRequestEligibilityError(user: UserProfile | null) {
  if (!user) {
    return "Não encontramos sua conta.";
  }

  if (!user.isCpfVerified) {
    return "Para publicar um pedido no mapa, confirme seu CPF no perfil.";
  }

  return null;
}

function getServiceChatAccent(type: ServicePin["type"]): ChatThread["accent"] {
  if (type === "Limpeza") {
    return "amber";
  }

  if (type === "Freelas") {
    return "emerald";
  }

  return "blue";
}

function getSessionReplacementDetails(error: unknown) {
  if (!(error instanceof ApiRequestError) || error.status !== 401) {
    return null;
  }

  const payload =
    error.data && typeof error.data === "object"
      ? (error.data as { details?: Record<string, unknown> })
      : null;
  const details = payload?.details;

  if (!details || details.code !== "SESSION_REPLACED") {
    return null;
  }

  const deviceLabel = String(details.deviceLabel ?? "outro aparelho").trim();
  const loginLocation = String(
    details.loginLocation ?? "localização aproximada indisponível"
  ).trim();
  const replacedAt = String(details.replacedAt ?? "").trim();
  let formattedDate = "";

  if (replacedAt) {
    try {
      formattedDate = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(replacedAt));
    } catch {
      formattedDate = "";
    }
  }

  return {
    message: `Sua conta foi acessada em ${deviceLabel}, em ${loginLocation}${
      formattedDate ? `, em ${formattedDate}` : ""
    }. Este aparelho foi desconectado por segurança.`,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(hydrateState);
  const liveStateRef = useRef(state);

  useEffect(() => {
    liveStateRef.current = state;
  }, [state]);

  const resolveRemoteAppState = async (
    token: string,
    previousRequest: ActiveServiceRequest | null = null,
    currentChats: ChatThread[] = [],
    currentPins: ServicePin[] = [],
    currentPosts: Post[] = [],
    activeChatId: string | null = null
  ): Promise<{
    pins: ServicePin[];
    posts: Post[];
    activeServiceRequest: ActiveServiceRequest | null;
    chats: ChatThread[];
  }> => {
    const [pinsResult, activeRequestResult, remoteChats, postsResult] = await Promise.all([
      loadRemotePins(token).then(
        (pins) => ({ ok: true as const, pins }),
        () => ({ ok: false as const, pins: currentPins })
      ),
      loadRemoteActiveServiceRequest(token).then(
        (request) => ({ ok: true as const, request }),
        () => ({ ok: false as const, request: previousRequest })
      ),
      safelyLoadRemoteChats(token),
      loadRemotePosts(token).then(
        (posts) => ({ ok: true as const, posts }),
        () => ({ ok: false as const, posts: currentPosts })
      ),
    ]);

    let activeServiceRequest: ActiveServiceRequest | null = null;

    if (activeRequestResult.ok) {
      activeServiceRequest = activeRequestResult.request
        ? mapRemoteActiveServiceRequest(activeRequestResult.request, previousRequest)
        : null;
    } else {
      activeServiceRequest = activeRequestResult.request as ActiveServiceRequest | null;
    }

    return {
      pins: pinsResult.pins,
      posts: postsResult.posts,
      activeServiceRequest,
      chats: mergeRemoteChats(currentChats, remoteChats, activeChatId),
    };
  };

  useEffect(() => {
    setState((current) => {
      const nextPins = current.pins.filter((pin) => !LEGACY_PIN_IDS.has(pin.id));
      const nextPosts = current.posts.filter((post) => !LEGACY_POST_IDS.has(post.id));
      const nextChats = current.chats.filter((chat) => !LEGACY_CHAT_IDS.has(chat.id));
      const nextActiveChatId =
        current.activeChatId && nextChats.some((chat) => chat.id === current.activeChatId)
          ? current.activeChatId
          : null;
      const nextActiveServiceRequest =
        current.activeServiceRequest?.chatId &&
        !nextChats.some((chat) => chat.id === current.activeServiceRequest?.chatId)
          ? { ...current.activeServiceRequest, chatId: null }
          : current.activeServiceRequest;

      if (
        nextPins.length === current.pins.length &&
        nextPosts.length === current.posts.length &&
        nextChats.length === current.chats.length &&
        nextActiveChatId === current.activeChatId &&
        nextActiveServiceRequest === current.activeServiceRequest
      ) {
        return current;
      }

      return {
        ...current,
        pins: nextPins,
        posts: nextPosts,
        chats: nextChats,
        activeChatId: nextActiveChatId,
        activeServiceRequest: nextActiveServiceRequest,
      };
    });
  }, []);

  useEffect(() => {
    const activeChatMissing =
      state.activeChatId && !state.chats.some((chat) => chat.id === state.activeChatId);
    const requestChatMissing =
      state.activeServiceRequest?.chatId &&
      !state.chats.some((chat) => chat.id === state.activeServiceRequest?.chatId);

    if (!activeChatMissing && !requestChatMissing) {
      return;
    }

    setState((current) => {
      const nextActiveChatId =
        current.activeChatId && current.chats.some((chat) => chat.id === current.activeChatId)
          ? current.activeChatId
          : null;
      const nextActiveServiceRequest =
        current.activeServiceRequest?.chatId &&
        !current.chats.some((chat) => chat.id === current.activeServiceRequest?.chatId)
          ? { ...current.activeServiceRequest, chatId: null }
          : current.activeServiceRequest;

      if (
        nextActiveChatId === current.activeChatId &&
        nextActiveServiceRequest === current.activeServiceRequest
      ) {
        return current;
      }

      return {
        ...current,
        activeChatId: nextActiveChatId,
        activeServiceRequest: nextActiveServiceRequest,
      };
    });
  }, [state.activeChatId, state.activeServiceRequest?.chatId, state.chats]);

  useEffect(() => {
    applyThemePreference(state.themePreference);
    persistThemePreference(state.themePreference);
  }, [state.themePreference]);

  useEffect(() => {
    const persistedState = {
      onboardingStep: state.onboardingStep,
      rememberSession: state.rememberSession,
      themePreference: state.themePreference,
      sessionToken: state.sessionToken,
      pendingVerification: state.pendingVerification,
      pendingDeviceVerification: state.pendingDeviceVerification,
      user: state.user,
      pins: state.pins,
      posts: state.posts,
      chats: state.chats,
      notifications: state.notifications,
      activeChatId: state.activeChatId,
      activeServiceRequest: state.activeServiceRequest,
    };

    const serializedState = JSON.stringify(persistedState);

    if (state.rememberSession) {
      window.localStorage.setItem(STORAGE_KEY, serializedState);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, serializedState);
      window.localStorage.removeItem(STORAGE_KEY);
    }

    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      if (!state.sessionToken) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            authReady: true,
            isAuthenticated: false,
            notifications: [],
            onboardingStep: resolveLoggedOutStep(current),
          }));
        }
        return;
      }

      try {
        const data = await apiRequest<{ user: UserProfile }>("/api/auth/session", {
          token: state.sessionToken,
        });
        const [remoteAppState, notifications] = await Promise.all([
          data.user.isAdmin || isProviderVerificationLocked(data.user)
            ? Promise.resolve(createEmptyRemoteAppState())
            : resolveRemoteAppState(
                state.sessionToken,
                state.activeServiceRequest,
                state.chats,
                state.pins,
                state.posts,
                state.activeChatId
              ),
          isProviderVerificationLocked(data.user)
            ? Promise.resolve([])
            : consumeRemoteNotifications(state.sessionToken),
        ]);

        if (cancelled) {
          return;
        }

        void deliverNativeNotifications(notifications);

        setState((current) => ({
          ...current,
          authReady: true,
          isAuthenticated: true,
          pendingVerification: null,
          pendingDeviceVerification: null,
          user: data.user,
          pins: remoteAppState.pins,
          posts: remoteAppState.posts,
          chats: remoteAppState.chats,
          notifications: mergeNotifications(current.notifications, notifications),
          activeServiceRequest: remoteAppState.activeServiceRequest,
          onboardingStep: resolveAuthenticatedStep(data.user),
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        const replacement = getSessionReplacementDetails(error);

        if (replacement) {
          clearPersistedStateStorage();
          dispatchSystemStatus({
            kind: "error",
            message: replacement.message,
          });
        }

        setState((current) => {
          const shouldClearSession =
            error instanceof ApiRequestError && error.status === 401;
          const hasCachedSession = Boolean(current.sessionToken && current.user);

          if (!shouldClearSession && hasCachedSession) {
            return {
              ...current,
              authReady: true,
              isAuthenticated: true,
              onboardingStep: resolveAuthenticatedStep(current.user),
            };
          }

          return {
            ...current,
            authReady: true,
            isAuthenticated: false,
            sessionToken: null,
            user: null,
            pins: [],
            posts: [],
            chats: [],
            notifications: [],
            activeServiceRequest: null,
            onboardingStep: resolveLoggedOutStep(current),
          };
        });
      }
    }

    hydrateAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.sessionToken || !state.isAuthenticated) {
      return;
    }

    let refreshInFlight = false;
    let invalidSessionHandled = false;

    const intervalId = window.setInterval(() => {
      const liveState = liveStateRef.current;

      if (
        refreshInFlight ||
        invalidSessionHandled ||
        !liveState.sessionToken ||
        !liveState.isAuthenticated ||
        (document.hidden && !isNativeAppRuntime())
      ) {
        return;
      }

      refreshInFlight = true;

      void (async () => {
        try {
          const [remoteAppState, remoteUser, notifications] = await Promise.all([
            resolveRemoteAppState(
              liveState.sessionToken,
              liveState.activeServiceRequest,
              liveState.chats,
              liveState.pins,
              liveState.posts,
              liveState.activeChatId
            ),
            loadRemoteSessionUser(liveState.sessionToken),
            consumeRemoteNotifications(liveState.sessionToken),
          ]);

          void deliverNativeNotifications(notifications);

          setState((current) => ({
            ...current,
            user: hydrateUserProfile(remoteUser) ?? current.user,
            pins: remoteAppState.pins,
            posts: remoteAppState.posts,
            chats: remoteAppState.chats,
            notifications: mergeNotifications(current.notifications, notifications),
            activeServiceRequest: remoteAppState.activeServiceRequest,
          }));
        } catch (error) {
          if (!(error instanceof ApiRequestError) || error.status !== 401) {
            return;
          }

          invalidSessionHandled = true;
          const replacement = getSessionReplacementDetails(error);
          clearPersistedStateStorage();

          setState((current) => ({
            ...current,
            authReady: true,
            isAuthenticated: false,
            sessionToken: null,
            user: null,
            pins: [],
            posts: [],
            chats: [],
            notifications: [],
            pendingVerification: null,
            pendingDeviceVerification: null,
            onboardingStep: "login",
            activeChatId: null,
            activeServiceRequest: null,
          }));

          dispatchSystemStatus({
            kind: "error",
            message:
              replacement?.message ??
              "Sua sessão terminou. Entre novamente para continuar com segurança.",
          });
        } finally {
          refreshInFlight = false;
        }
      })();

      if (
        liveState.activeChatId &&
        typeof window !== "undefined" &&
        window.location.pathname === "/app/chat"
      ) {
        void apiRequest(`/api/chats/${liveState.activeChatId}/read`, {
          method: "PATCH",
          token: liveState.sessionToken,
          suppressSystemStatus: true,
        }).catch(() => undefined);
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [state.isAuthenticated, state.sessionToken]);

  const login = async ({ email, password, rememberMe = true }: LoginPayload): Promise<Result> => {
    try {
      const normalizedEmail = String(email ?? "").trim();
      const normalizedPassword = String(password ?? "").trim();
      const session = await apiRequest<SessionResponse>("/api/auth/login", {
        method: "POST",
        body: {
          email: normalizedEmail,
          password: normalizedPassword,
          rememberMe,
          ...getDeviceIdentity(),
        },
      });

      if (session.requiresDeviceVerification && session.pendingDeviceVerification) {
        setState((current) => ({
          ...current,
          authReady: true,
          isAuthenticated: false,
          rememberSession: rememberMe,
          sessionToken: null,
          user: null,
          pendingVerification: null,
          pendingDeviceVerification: session.pendingDeviceVerification ?? null,
          onboardingStep: "device-verify",
        }));

        return { ok: true, requiresDeviceVerification: true };
      }

      if (!session.token || !session.user) {
        throw new Error("O servidor não retornou uma sessão válida.");
      }

      const sessionToken = session.token;
      const sessionUser = session.user;
      const remoteAppState = sessionUser.isAdmin || isProviderVerificationLocked(sessionUser)
        ? createEmptyRemoteAppState()
        : await resolveRemoteAppState(sessionToken);

      setState((current) => ({
        ...current,
        rememberSession: rememberMe,
        sessionToken,
        user: sessionUser,
        isAuthenticated: true,
        authReady: true,
        pins: remoteAppState.pins,
        posts: remoteAppState.posts,
        chats: remoteAppState.chats,
        notifications: [],
        pendingVerification: null,
        pendingDeviceVerification: null,
        onboardingStep: resolveAuthenticatedStep(sessionUser),
        activeChatId: null,
        activeServiceRequest: remoteAppState.activeServiceRequest,
      }));

      return { ok: true, user: sessionUser };
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 403 &&
        error.data &&
        typeof error.data === "object" &&
        "details" in error.data &&
        error.data.details &&
        typeof error.data.details === "object" &&
        "pendingVerification" in error.data.details &&
        error.data.details.pendingVerification
      ) {
        setState((current) => ({
          ...current,
          authReady: true,
          isAuthenticated: false,
          rememberSession: rememberMe,
          sessionToken: null,
          user: null,
          pendingVerification: error.data.details.pendingVerification as PendingVerification,
          pendingDeviceVerification: null,
          onboardingStep: "verify",
        }));
      }

      return {
        ok: false,
        error: error instanceof Error ? error.message : "Não conseguimos entrar agora.",
      };
    }
  };

  const verifyDeviceLogin = async (code: string): Promise<Result> => {
    const pending = state.pendingDeviceVerification;

    if (!pending) {
      return {
        ok: false,
        error: "Faça o login novamente para confirmar este aparelho.",
      };
    }

    try {
      const session = await apiRequest<SessionResponse>("/api/auth/device/verify", {
        method: "POST",
        body: {
          challengeId: pending.challengeId,
          code,
        },
      });

      if (!session.token || !session.user) {
        throw new Error("O servidor não retornou uma sessão válida.");
      }

      const sessionToken = session.token;
      const sessionUser = session.user;
      const remoteAppState = sessionUser.isAdmin || isProviderVerificationLocked(sessionUser)
        ? createEmptyRemoteAppState()
        : await resolveRemoteAppState(sessionToken);

      setState((current) => ({
        ...current,
        authReady: true,
        isAuthenticated: true,
        sessionToken,
        user: sessionUser,
        pendingVerification: null,
        pendingDeviceVerification: null,
        pins: remoteAppState.pins,
        posts: remoteAppState.posts,
        chats: remoteAppState.chats,
        notifications: [],
        onboardingStep: resolveAuthenticatedStep(sessionUser),
        activeChatId: null,
        activeServiceRequest: remoteAppState.activeServiceRequest,
      }));

      return { ok: true, user: sessionUser };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos confirmar este aparelho.",
      };
    }
  };

  const cancelDeviceVerification = () => {
    setState((current) => ({
      ...current,
      authReady: true,
      isAuthenticated: false,
      sessionToken: null,
      user: null,
      pendingDeviceVerification: null,
      onboardingStep: current.pendingVerification ? "verify" : "login",
    }));
  };

  const logout = async () => {
    if (state.sessionToken) {
      await unregisterNativePushDevice(state.sessionToken).catch(() => undefined);

      try {
        await apiRequest("/api/auth/logout", {
          method: "POST",
          token: state.sessionToken,
        });
      } catch {
        // O estado local deve ser limpo mesmo se a revogação falhar.
      }
    }

    clearPersistedStateStorage();

    setState((current) => ({
      ...current,
      authReady: true,
      isAuthenticated: false,
      sessionToken: null,
      user: null,
      pins: [],
      posts: [],
      chats: [],
      notifications: [],
      pendingVerification: null,
      pendingDeviceVerification: null,
      onboardingStep: "login",
      activeChatId: null,
      activeServiceRequest: null,
    }));
  };

  const completeAppTour = async (): Promise<Result> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos uma sessão válida para concluir as dicas.",
      };
    }

    try {
      const data = await apiRequest<{ user: UserProfile }>(
        "/api/me/tutorial/complete",
        {
          method: "POST",
          token: state.sessionToken,
          suppressSystemStatus: true,
        }
      );

      setState((current) => ({
        ...current,
        user: hydrateUserProfile(data.user) ?? current.user,
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos registrar a conclusão das dicas.",
      };
    }
  };

  const deleteAccount = async (): Promise<Result> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para excluir a conta.",
      };
    }

    try {
      await unregisterNativePushDevice(state.sessionToken).catch(() => undefined);
      await apiRequest("/api/me/account", {
        method: "DELETE",
        token: state.sessionToken,
      });
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos excluir sua conta agora.",
      };
    }

    clearPersistedStateStorage();

    setState((current) => ({
      ...current,
      authReady: true,
      isAuthenticated: false,
      sessionToken: null,
      user: null,
      pins: [],
      posts: [],
      chats: [],
      notifications: [],
      pendingVerification: null,
      pendingDeviceVerification: null,
      onboardingStep: "login",
      activeChatId: null,
      activeServiceRequest: null,
    }));

    return {
      ok: true,
      message: "Sua conta foi excluída e os dados pessoais foram removidos ou anonimizados.",
    };
  };

  const register = async (payload: RegistrationDraft): Promise<Result> => {
    try {
      const pendingUser = await apiRequest<PendingVerification>("/api/auth/register", {
        method: "POST",
        body: payload,
      });

      setState((current) => ({
        ...current,
        authReady: true,
        isAuthenticated: false,
        sessionToken: null,
        user: null,
        pendingVerification: pendingUser,
        pendingDeviceVerification: null,
        onboardingStep: "verify",
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos criar sua conta agora.",
      };
    }
  };

  const requestVerificationCode = async (): Promise<Result> => {
    if (!state.pendingVerification) {
      return {
        ok: false,
        error: "Não encontramos um cadastro pendente para validar.",
      };
    }

    try {
      const data = await apiRequest<{
        destination: string;
        provider: string;
        debugCode: string | null;
      }>("/api/auth/send-verification", {
        method: "POST",
        body: {
          userId: state.pendingVerification.userId,
        },
      });

      return {
        ok: true,
        message: data.provider.startsWith("mock")
          ? `Código enviado em modo de desenvolvimento para ${data.destination}. Código: ${data.debugCode}.`
          : `Código enviado para ${data.destination}.`,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos enviar o código agora.",
      };
    }
  };

  const completeVerification = async ({
    code,
    acceptTerms,
    acceptPrivacy,
    legalVersion,
  }: {
    code: string;
    acceptTerms: boolean;
    acceptPrivacy: boolean;
    legalVersion: string;
  }): Promise<Result> => {
    if (!state.pendingVerification) {
      return {
        ok: false,
        error: "Não encontramos um cadastro pendente para validar.",
      };
    }

    try {
      const session = await apiRequest<SessionResponse>("/api/auth/verify", {
        method: "POST",
        body: {
          code,
          userId: state.pendingVerification.userId,
          acceptTerms,
          acceptPrivacy,
          legalVersion,
          rememberMe: state.rememberSession,
          ...getDeviceIdentity(),
        },
      });

      if (!session.token || !session.user) {
        throw new Error("O servidor não retornou uma sessão válida.");
      }

      const sessionToken = session.token;
      const sessionUser = session.user;
      const remoteAppState = sessionUser.isAdmin || isProviderVerificationLocked(sessionUser)
        ? createEmptyRemoteAppState()
        : await resolveRemoteAppState(sessionToken);

      setState((current) => ({
        ...current,
        sessionToken,
        user: sessionUser,
        rememberSession: current.rememberSession,
        authReady: true,
        isAuthenticated: true,
        pins: remoteAppState.pins,
        posts: remoteAppState.posts,
        chats: remoteAppState.chats,
        notifications: [],
        pendingVerification: null,
        pendingDeviceVerification: null,
        activeServiceRequest: remoteAppState.activeServiceRequest,
        onboardingStep: resolveAuthenticatedStep(sessionUser),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos validar o código agora.",
      };
    }
  };

  const finishProfileSetup = async (avatar: string): Promise<Result> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos uma sessão válida para concluir o cadastro.",
      };
    }

    try {
      const data = await apiRequest<{ user: UserProfile }>("/api/me/profile", {
        method: "PATCH",
        token: state.sessionToken,
        body: { avatar },
      });

      setState((current) => ({
        ...current,
        user: data.user,
        onboardingStep: "app",
        isAuthenticated: true,
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos concluir o cadastro agora.",
      };
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<Result> => {
    if (!state.user || !state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua conta.",
      };
    }

    const nextCpf = updates.cpf ?? state.user.cpf;
    const normalizedCpf = formatCpf(nextCpf);
    const cpfFilled = normalizedCpf.replace(/\D/g, "").length > 0;
    const cpfIsValid = cpfFilled ? isValidCpf(normalizedCpf) : false;

    if (cpfFilled && !cpfIsValid) {
      return {
        ok: false,
        error: "CPF inválido. Confira os 11 dígitos antes de salvar.",
      };
    }

    try {
      const data = await apiRequest<{ user: UserProfile }>("/api/me/profile", {
        method: "PATCH",
        token: state.sessionToken,
        body: {
          ...updates,
          cpf: normalizedCpf,
        },
      });

      setState((current) => ({
        ...current,
        user: data.user,
        onboardingStep: resolveAuthenticatedStep(data.user),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos salvar seu perfil agora.",
      };
    }
  };

  const submitProviderVerification = async (payload: {
    cpf: string;
    rgNumber: string;
    faceImage: string;
    rgDocumentImage: string;
  }): Promise<Result> => {
    if (!state.user || !state.sessionToken) {
      return { ok: false, error: "Não encontramos sua conta." };
    }

    const normalizedCpf = formatCpf(payload.cpf);

    if (!isValidCpf(normalizedCpf)) {
      return { ok: false, error: "CPF inválido. Confira os 11 dígitos antes de enviar." };
    }

    try {
      const data = await apiRequest<{ user: UserProfile }>(
        "/api/me/provider-verification",
        {
          method: "POST",
          token: state.sessionToken,
          body: { ...payload, cpf: normalizedCpf },
        }
      );

      const user = hydrateUserProfile(data.user) ?? data.user;
      setState((current) => ({
        ...current,
        user,
        pins: [],
        posts: [],
        chats: [],
        activeServiceRequest: null,
        onboardingStep: resolveAuthenticatedStep(user),
      }));

      return { ok: true, user };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos enviar seus documentos agora.",
      };
    }
  };

  const verifyCpf = async (cpf: string): Promise<Result> => {
    if (!state.user || !state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua conta.",
      };
    }

    const normalizedCpf = formatCpf(cpf);

    if (!normalizedCpf.replace(/\D/g, "")) {
      return {
        ok: false,
        error: "Informe um CPF para continuar.",
      };
    }

    if (!isValidCpf(normalizedCpf)) {
      return {
        ok: false,
        error: "CPF inválido. Confira os 11 dígitos antes de validar.",
      };
    }

    try {
      const data = await apiRequest<{ user: UserProfile }>("/api/me/cpf/verify", {
        method: "POST",
        token: state.sessionToken,
        body: {
          cpf: normalizedCpf,
        },
      });

      setState((current) => ({
        ...current,
        user: data.user,
      }));

      return {
        ok: true,
        message: "CPF verificado com sucesso.",
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Não conseguimos validar o CPF agora.",
      };
    }
  };

  const completeGoogleLogin = async ({
    token,
    pendingVerification,
    pendingDeviceVerification,
    rememberMe = true,
  }: {
    token?: string;
    pendingVerification?: PendingVerification;
    pendingDeviceVerification?: PendingDeviceVerification;
    rememberMe?: boolean;
  }): Promise<Result> => {
    if (pendingDeviceVerification) {
      setState((current) => ({
        ...current,
        authReady: true,
        isAuthenticated: false,
        rememberSession: rememberMe,
        sessionToken: null,
        user: null,
        pendingVerification: null,
        pendingDeviceVerification,
        onboardingStep: "device-verify",
      }));

      return {
        ok: true,
        requiresDeviceVerification: true,
      };
    }

    if (pendingVerification) {
      setState((current) => ({
        ...current,
        authReady: true,
        isAuthenticated: false,
        rememberSession: rememberMe,
        sessionToken: null,
        user: null,
        pendingVerification,
        pendingDeviceVerification: null,
        onboardingStep: "verify",
      }));

      return {
        ok: true,
        requiresVerification: true,
      };
    }

    if (!token) {
      return {
        ok: false,
        error: "O retorno do Google não trouxe uma sessão válida.",
      };
    }

    try {
      const session = await apiRequest<{ user: UserProfile }>("/api/auth/session", {
        token,
      });
      const remoteAppState = session.user.isAdmin || isProviderVerificationLocked(session.user)
        ? createEmptyRemoteAppState()
        : await resolveRemoteAppState(token);

      setState((current) => ({
        ...current,
        rememberSession: rememberMe,
        sessionToken: token,
        user: session.user,
        isAuthenticated: true,
        authReady: true,
        pins: remoteAppState.pins,
        posts: remoteAppState.posts,
        chats: remoteAppState.chats,
        notifications: [],
        pendingVerification: null,
        pendingDeviceVerification: null,
        onboardingStep: resolveAuthenticatedStep(session.user),
        activeChatId: null,
        activeServiceRequest: remoteAppState.activeServiceRequest,
      }));

      return { ok: true, user: session.user };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos concluir o login com Google.",
      };
    }
  };

  const addPost = async (payload: PostComposerPayload): Promise<Result> => {
    if (!state.user || !state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para publicar no mural.",
      };
    }

    try {
      const data = await apiRequest<{ post: Post }>("/api/posts", {
        method: "POST",
        token: state.sessionToken,
        body: payload,
      });

      const nextPost = hydratePost(data.post);

      setState((current) => ({
        ...current,
        posts: [nextPost, ...current.posts.filter((post) => post.id !== data.post.id)]
          .filter(isActivePost),
      }));

      return { ok: true, post: nextPost };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos publicar no mural agora.",
      };
    }
  };

  const removePost = async (postId: string): Promise<Result> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para remover esse post.",
      };
    }

    try {
      await apiRequest(`/api/posts/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        token: state.sessionToken,
      });

      setState((current) => ({
        ...current,
        posts: current.posts.filter((post) => post.id !== postId),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Não conseguimos remover esse post.",
      };
    }
  };

  const createServiceRequest = async ({
    accuracy,
    description,
    latitude,
    locationLabel,
    longitude,
    type,
  }: ServiceRequestComposerPayload): Promise<Result> => {
    if (!state.user || !state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para publicar o pedido.",
      };
    }

    const eligibilityError = resolveCreateServiceRequestEligibilityError(state.user);

    if (eligibilityError) {
      return {
        ok: false,
        error: eligibilityError,
      };
    }

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest }>("/api/service-requests", {
        method: "POST",
        token: state.sessionToken,
        body: {
          type,
          description,
          latitude,
          longitude,
          accuracy,
          locationLabel,
        },
      });

      setState((current) => ({
        ...current,
        activeChatId: null,
        activeServiceRequest: mapRemoteActiveServiceRequest(
          data.request,
          current.activeServiceRequest
        ),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos publicar seu pedido agora."
        ),
      };
    }
  };

  const takeServiceRequest = async (requestId: string): Promise<Result> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para pegar a solicitação.",
      };
    }

    if (!state.user?.isCpfVerified) {
      return {
        ok: false,
        error: "Para ver e pegar serviços, confirme seu CPF no perfil.",
      };
    }

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest }>(
        `/api/service-requests/${requestId}/take`,
        {
          method: "PATCH",
          token: state.sessionToken,
        }
      );
      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        mapRemoteActiveServiceRequest(data.request, state.activeServiceRequest),
        state.chats,
        state.pins
      );

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeServiceRequest:
          remoteAppState.activeServiceRequest ??
          mapRemoteActiveServiceRequest(data.request, current.activeServiceRequest),
      }));

      return {
        ok: true,
        message: "Solicitação assumida com sucesso.",
      };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos pegar esta solicitação agora."
        ),
      };
    }
  };

  const refreshServicePins = async (): Promise<Result> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para atualizar o mapa.",
      };
    }

    try {
      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        state.activeServiceRequest,
        state.chats,
        state.pins
      );

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeChatId: state.activeServiceRequest?.chatId ?? current.activeChatId,
        activeServiceRequest: remoteAppState.activeServiceRequest,
      }));

      return {
        ok: true,
        message: "Mapa atualizado.",
      };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos atualizar o mapa agora."
        ),
      };
    }
  };

  const acceptWorkerInterest = async (): Promise<AcceptWorkerResult> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para abrir a conversa.",
      };
    }

    try {
      const data = await apiRequest<{
        request: RemoteServiceRequest | null;
        chat: ChatThread;
      }>(`/api/service-requests/${state.activeServiceRequest.id}/accept`, {
        method: "PATCH",
        token: state.sessionToken,
      });
      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        data.request
          ? mapRemoteActiveServiceRequest(data.request, state.activeServiceRequest)
          : state.activeServiceRequest,
        state.chats,
        state.pins
      );
      const acceptedChat = hydrateChat(data.chat);

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: upsertChatList(remoteAppState.chats, acceptedChat),
        activeChatId: acceptedChat.id,
        activeServiceRequest:
          remoteAppState.activeServiceRequest ??
          (data.request
            ? mapRemoteActiveServiceRequest(data.request, current.activeServiceRequest)
            : current.activeServiceRequest),
      }));

      return {
        ok: true,
        chatId: acceptedChat.id,
      };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos abrir esta conversa agora."
        ),
      };
    }
  };

  const declineWorkerInterest = async (
    options: { blockWorkerForTenMinutes?: boolean } = {}
  ): Promise<Result> => {
    const liveState = liveStateRef.current;

    if (!liveState.sessionToken || !liveState.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para continuar buscando.",
      };
    }

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest | null }>(
        `/api/service-requests/${liveState.activeServiceRequest.id}/decline`,
        {
          method: "PATCH",
          token: liveState.sessionToken,
          body: {
            blockWorkerForTenMinutes: Boolean(options.blockWorkerForTenMinutes),
          },
        }
      );
      const remoteAppState = await resolveRemoteAppState(
        liveState.sessionToken,
        data.request
          ? mapRemoteActiveServiceRequest(data.request, liveState.activeServiceRequest)
          : null,
        liveState.chats,
        liveState.pins,
        liveState.posts
      );

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeServiceRequest:
          remoteAppState.activeServiceRequest ??
          (data.request
            ? mapRemoteActiveServiceRequest(data.request, current.activeServiceRequest)
            : null),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos seguir buscando outros profissionais agora."
        ),
      };
    }
  };

  const confirmServiceDeal = () => {
    setState((current) => {
      const request = current.activeServiceRequest;

      if (!request) {
        return current;
      }

      return {
        ...current,
        activeServiceRequest: {
          ...request,
          status: "details",
        },
      };
    });
  };

  const submitServiceDetails = async ({
    address,
    delayToleranceMinutes,
    latitude,
    locationMode,
    locationLabel,
    longitude,
    price,
    serviceDate,
    schedule,
    title,
    accuracy,
  }: ServiceDetailsPayload): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para atualizar.",
      };
    }

    const normalizedAddress =
      locationMode === "residence"
        ? state.user?.address?.trim() || address.trim()
        : address.trim();

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest }>(
        `/api/service-requests/${state.activeServiceRequest.id}/details`,
        {
          method: "PATCH",
          token: state.sessionToken,
          body: {
            title,
            price,
            serviceDate,
            schedule,
            delayToleranceMinutes,
            locationMode,
            address: normalizedAddress,
            latitude,
            longitude,
            accuracy: accuracy ?? null,
            locationLabel: locationLabel ?? normalizedAddress,
          },
        }
      );

      if (state.activeServiceRequest.chatId) {
        await apiRequest(`/api/chats/${state.activeServiceRequest.chatId}/messages`, {
          method: "POST",
          token: state.sessionToken,
          suppressSystemStatus: true,
          body: {
            body: `Fechamos assim: ${title.trim()}, valor ${price}, data ${formatServiceDate(
              serviceDate,
              "medium"
            )}, horário ${schedule}, tolerância de atraso de ${formatDelayTolerance(
              delayToleranceMinutes
            )} e local ${
              locationMode === "residence"
                ? "no meu endereço (liberado após o pagamento)"
                : "em outro local (endereço liberado após o pagamento)"
            }.`,
          },
        }).catch(() => undefined);
      }

      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        mapRemoteActiveServiceRequest(data.request, state.activeServiceRequest),
        state.chats,
        state.pins
      );

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeServiceRequest:
          remoteAppState.activeServiceRequest ??
          mapRemoteActiveServiceRequest(data.request, current.activeServiceRequest),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos enviar os detalhes do atendimento agora."
        ),
      };
    }
  };

  const advanceServiceToPayment = async (): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para confirmar.",
      };
    }

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest }>(
        `/api/service-requests/${state.activeServiceRequest.id}/payment-ready`,
        {
          method: "PATCH",
          token: state.sessionToken,
        }
      );

      if (state.activeServiceRequest.chatId) {
        await apiRequest(`/api/chats/${state.activeServiceRequest.chatId}/messages`, {
          method: "POST",
          token: state.sessionToken,
          suppressSystemStatus: true,
          body: {
            body: "Revisei os detalhes. Pode seguir com o pagamento para confirmar. O valor fica retido no intermediador do Worko e só é liberado depois que a cliente concluir o serviço.",
          },
        }).catch(() => undefined);
      }

      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        mapRemoteActiveServiceRequest(data.request, state.activeServiceRequest),
        state.chats,
        state.pins
      );

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeServiceRequest:
          remoteAppState.activeServiceRequest ??
          mapRemoteActiveServiceRequest(data.request, current.activeServiceRequest),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos liberar o pagamento agora."
        ),
      };
    }
  };

  const createServicePaymentSession = async (): Promise<ServicePaymentSessionResult> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para abrir o pagamento.",
      };
    }

    try {
      const data = await apiRequest<{
        paymentId?: string;
        paymentStatus?: string;
        invoiceUrl?: string | null;
        dueDate?: string | null;
        pixCopyPaste?: string | null;
        pixQrCodeBase64?: string | null;
        expiresAt?: string | null;
      }>(
        `/api/service-requests/${state.activeServiceRequest.id}/payment-session`,
        {
          method: "POST",
          token: state.sessionToken,
        }
      );

      if (!data.paymentId) {
        return {
          ok: false,
          error: "O intermediador Pix não retornou uma cobrança válida para este pedido.",
        };
      }

      return {
        ok: true,
        paymentId: data.paymentId,
        paymentStatus: data.paymentStatus,
        invoiceUrl: data.invoiceUrl ?? null,
        dueDate: data.dueDate ?? null,
        pixCopyPaste: data.pixCopyPaste ?? null,
        pixQrCodeBase64: data.pixQrCodeBase64 ?? null,
        expiresAt: data.expiresAt ?? null,
      };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos abrir o pagamento seguro agora."
        ),
      };
    }
  };

  const refreshServicePaymentStatus = async (): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para verificar pagamento.",
      };
    }

    try {
      const paymentState = await apiRequest<{
        paymentId?: string | null;
        paymentStatus?: string | null;
        status?: string | null;
        invoiceUrl?: string | null;
        dueDate?: string | null;
        pixCopyPaste?: string | null;
        pixQrCodeBase64?: string | null;
        expiresAt?: string | null;
      }>(`/api/service-requests/${state.activeServiceRequest.id}/payment-status`, {
        method: "PATCH",
        token: state.sessionToken,
      });

      const normalizedPaymentStatus = String(
        paymentState.status ?? paymentState.paymentStatus ?? ""
      )
        .trim()
        .toUpperCase();
      const providerConfirmedPayment =
        normalizedPaymentStatus === "RECEIVED" ||
        normalizedPaymentStatus === "CONFIRMED";

      if (!providerConfirmedPayment) {
        if (
          normalizedPaymentStatus === "EXPIRED" ||
          normalizedPaymentStatus === "OVERDUE"
        ) {
          return {
            ok: false,
            error: "Esta cobrança Pix expirou. Gere um novo Pix para continuar.",
          };
        }

        if (
          normalizedPaymentStatus === "PENDING" ||
          normalizedPaymentStatus === "UNPAID" ||
          normalizedPaymentStatus === "NO_PAYMENT_REQUIRED"
        ) {
          return {
            ok: true,
            message:
              "O Pix ainda não foi compensado no intermediador. Assim que entrar, o app libera o atendimento.",
          };
        }

        return {
          ok: true,
          message: "Estamos aguardando a confirmação final do Pix para liberar o atendimento.",
        };
      }

      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        state.activeServiceRequest,
        state.chats,
        state.pins
      );
      const nextActiveRequest = remoteAppState.activeServiceRequest;
      const previousStatus = state.activeServiceRequest.status;
      const paymentConfirmed = nextActiveRequest?.status === "confirmed";

      if (paymentConfirmed && previousStatus !== "confirmed" && state.activeServiceRequest.chatId) {
        const confirmedDetails = nextActiveRequest?.details ?? state.activeServiceRequest.details;

        await apiRequest(`/api/chats/${state.activeServiceRequest.chatId}/messages`, {
          method: "POST",
          token: state.sessionToken,
          suppressSystemStatus: true,
          body: {
            body: confirmedDetails
              ? `Pagamento Pix confirmado. Atendimento agendado para ${formatServiceDate(
                  confirmedDetails.serviceDate,
                  "medium"
                )} as ${confirmedDetails.schedule}. Tolerância de atraso: ${formatDelayTolerance(
                  confirmedDetails.delayToleranceMinutes
                )}. O valor ficou retido no intermediador do Worko e será liberado pela cliente após a conclusão.`
              : "Pagamento Pix confirmado. Vou iniciar o atendimento conforme combinamos.",
          },
        }).catch(() => undefined);
      }

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeServiceRequest: nextActiveRequest ?? current.activeServiceRequest,
      }));

      if (paymentConfirmed) {
        return {
          ok: true,
          message: "Pagamento confirmado com sucesso.",
        };
      }

      return {
        ok: true,
        message: "Estamos aguardando a confirmação final do Pix para liberar o atendimento.",
      };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos verificar este pagamento agora."
        ),
      };
    }
  };

  const cancelActiveServiceRequest = async (): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      setState((current) => ({
        ...current,
        activeServiceRequest: null,
        activeChatId: null,
      }));

      return { ok: true };
    }

    try {
      await apiRequest(`/api/service-requests/${state.activeServiceRequest.id}/cancel`, {
        method: "PATCH",
        token: state.sessionToken,
      });
      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        null,
        state.chats,
        state.pins
      );

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeServiceRequest: null,
        activeChatId: null,
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos cancelar seu pedido agora."
        ),
      };
    }
  };

  const deleteActiveServiceRequest = async (): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      setState((current) => ({
        ...current,
        activeServiceRequest: null,
        activeChatId: null,
      }));

      return { ok: true };
    }

    try {
      await apiRequest(`/api/service-requests/${state.activeServiceRequest.id}`, {
        method: "DELETE",
        token: state.sessionToken,
      });
      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        null,
        state.chats,
        state.pins
      );

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeServiceRequest: null,
        activeChatId: null,
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: resolveServiceRequestApiError(
          error,
          "Não conseguimos apagar este pedido agora."
        ),
      };
    }
  };

  const markServicePaid = async (): Promise<Result> => refreshServicePaymentStatus();

  const markWorkerArrived = async (): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para registrar a chegada.",
      };
    }

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest }>(
        `/api/service-requests/${state.activeServiceRequest.id}/worker-arrived`,
        {
          method: "PATCH",
          token: state.sessionToken,
        }
      );

      setState((current) => ({
        ...current,
        activeServiceRequest: data.request
          ? mapRemoteActiveServiceRequest(data.request, current.activeServiceRequest)
          : current.activeServiceRequest,
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos registrar a chegada agora.",
      };
    }
  };

  const openServiceDispute = async (reason: string): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para abrir disputa.",
      };
    }

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest }>(
        `/api/service-requests/${state.activeServiceRequest.id}/dispute`,
        {
          method: "PATCH",
          token: state.sessionToken,
          body: { reason },
        }
      );

      setState((current) => ({
        ...current,
        activeServiceRequest: data.request
          ? mapRemoteActiveServiceRequest(data.request, current.activeServiceRequest)
          : current.activeServiceRequest,
      }));

      await refreshSessionState();

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos abrir a disputa agora.",
      };
    }
  };

  const reportProviderNoShow = async (payload: {
    reason: string;
    evidenceImage?: string | null;
  }): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento ativo para solicitar o ressarcimento.",
      };
    }

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest }>(
        `/api/service-requests/${state.activeServiceRequest.id}/no-show`,
        {
          method: "PATCH",
          token: state.sessionToken,
          body: payload,
        }
      );

      setState((current) => ({
        ...current,
        activeServiceRequest: mapRemoteActiveServiceRequest(
          data.request,
          current.activeServiceRequest
        ),
      }));

      await refreshSessionState();

      return {
        ok: true,
        message: "Solicitação registrada. O pagamento permanece bloqueado até a conclusão.",
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos solicitar o ressarcimento agora.",
      };
    }
  };

  const respondProviderNoShow = async (payload: {
    response: string;
    acknowledgesNoShow: boolean;
  }): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos o atendimento para registrar sua resposta.",
      };
    }

    try {
      const data = await apiRequest<{ request: RemoteServiceRequest | null }>(
        `/api/service-requests/${state.activeServiceRequest.id}/no-show-response`,
        {
          method: "PATCH",
          token: state.sessionToken,
          body: payload,
        }
      );

      setState((current) => ({
        ...current,
        activeServiceRequest: data.request
          ? mapRemoteActiveServiceRequest(data.request, current.activeServiceRequest)
          : null,
      }));

      await refreshSessionState();

      return {
        ok: true,
        message: payload.acknowledgesNoShow
          ? "Ausência confirmada e ressarcimento integral iniciado."
          : "Sua resposta foi enviada para análise da administração.",
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos registrar sua resposta agora.",
      };
    }
  };

  const refreshSessionState = async (): Promise<Result> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para atualizar o app.",
      };
    }

    try {
      const remoteUser = await loadRemoteSessionUser(state.sessionToken);
      const [remoteAppState, incomingNotifications] = await Promise.all([
        remoteUser.isAdmin || isProviderVerificationLocked(remoteUser)
          ? Promise.resolve(createEmptyRemoteAppState())
          : resolveRemoteAppState(
              state.sessionToken,
              state.activeServiceRequest,
              state.chats,
              state.pins,
              state.posts,
              state.activeChatId
            ),
        isProviderVerificationLocked(remoteUser)
          ? Promise.resolve([])
          : consumeRemoteNotifications(state.sessionToken),
      ]);
      const notifications = incomingNotifications.filter(
        (notification) => {
          const isVisibleDocument = typeof document !== "undefined" && !document.hidden;
          const isChatRoute =
            typeof window !== "undefined" && window.location.pathname === "/app/chat";

          return !(
            isVisibleDocument &&
            notification.kind === "chat-message" &&
            isChatRoute
          );
        }
      );

      void deliverNativeNotifications(notifications);

      setState((current) => ({
        ...current,
        user: hydrateUserProfile(remoteUser) ?? current.user,
        pins: remoteAppState.pins,
        posts: remoteAppState.posts,
        chats: remoteAppState.chats,
        notifications: mergeNotifications(current.notifications, notifications),
        activeServiceRequest: remoteAppState.activeServiceRequest,
        onboardingStep: resolveAuthenticatedStep(remoteUser),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos atualizar seu perfil agora.",
      };
    }
  };

  const releaseServicePayment = async ({
    comment,
    rating,
  }: ServiceReviewPayload): Promise<Result> => {
    if (!state.sessionToken || !state.activeServiceRequest) {
      return {
        ok: false,
        error: "Não encontramos um atendimento confirmado para liberar o pagamento.",
      };
    }

    try {
      await apiRequest(
        `/api/service-requests/${state.activeServiceRequest.id}/release-payment`,
        {
          method: "PATCH",
          token: state.sessionToken,
          body: {
            rating,
            comment,
          },
        }
      );

      const remoteAppState = await resolveRemoteAppState(
        state.sessionToken,
        null,
        state.chats,
        state.pins
      );

      setState((current) => ({
        ...current,
        pins: remoteAppState.pins,
        chats: remoteAppState.chats,
        activeChatId: current.activeChatId,
        activeServiceRequest: remoteAppState.activeServiceRequest,
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos liberar este pagamento agora.",
      };
    }
  };

  const listCompletedServiceRequests = async (): Promise<CompletedServiceRequestsResult> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para carregar o histórico.",
      };
    }

    try {
      const response = await apiRequest<{ requests: RemoteServiceRequest[] }>(
        "/api/service-requests/history",
        {
          token: state.sessionToken,
        }
      );

      return {
        ok: true,
        requests: response.requests.map((request) =>
          mapRemoteActiveServiceRequest(request, null)
        ),
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos carregar o histórico agora.",
      };
    }
  };

  const openChat = (chatId: string) => {
    setState((current) => ({
      ...current,
      activeChatId: chatId,
      chats: updateChatList(current.chats, chatId, (chat) => ({
        ...chat,
        unread: 0,
      })),
    }));

    const token = liveStateRef.current.sessionToken;

    if (!token) {
      return;
    }

    void apiRequest<{ chat: ChatThread }>(`/api/chats/${encodeURIComponent(chatId)}/read`, {
      method: "PATCH",
      token,
      suppressSystemStatus: true,
    })
      .then((data) => {
        const nextChat = hydrateChat(data.chat);

        setState((current) => ({
          ...current,
          activeChatId: chatId,
          chats: upsertChatList(current.chats, { ...nextChat, unread: 0 }),
        }));
      })
      .catch(() => undefined);
  };

  const openChatFromPost = async (postId: string): Promise<AcceptWorkerResult> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para abrir essa conversa.",
      };
    }

    try {
      const data = await apiRequest<{ chat: ChatThread; post: Post }>(`/api/posts/${postId}/chat`, {
        method: "POST",
        token: state.sessionToken,
      });
      const nextChat = hydrateChat(data.chat);
      const nextPost = hydratePost(data.post);
      const chatHasMessages = hasChatMessages(nextChat);

      setState((current) => ({
        ...current,
        activeChatId: chatHasMessages ? nextChat.id : current.activeChatId,
        posts: current.posts.some((post) => post.id === nextPost.id)
          ? current.posts.map((post) => (post.id === nextPost.id ? nextPost : post))
          : [nextPost, ...current.posts],
        chats: chatHasMessages
          ? upsertChatList(
              current.chats,
              nextChat.unread > 0 ? { ...nextChat, unread: 0 } : nextChat
            )
          : current.chats.filter((chat) => chat.id !== nextChat.id),
      }));

      if (chatHasMessages) {
        void apiRequest(`/api/chats/${nextChat.id}/read`, {
          method: "PATCH",
          token: state.sessionToken,
          suppressSystemStatus: true,
        }).catch(() => undefined);
      }

      return {
        ok: true,
        chatId: chatHasMessages ? nextChat.id : undefined,
        requestSent: !chatHasMessages,
        message: chatHasMessages ? undefined : "Solicitação enviada ao(à) prestador(a).",
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos abrir essa conversa agora.",
      };
    }
  };

  const clearActiveChat = () => {
    setState((current) => ({
      ...current,
      chats: current.chats.filter(
        (chat) => chat.id !== current.activeChatId || hasChatMessages(chat)
      ),
      activeChatId: null,
    }));
  };

  const startServiceFromChat = async (chatId: string): Promise<AcceptWorkerResult> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para fechar o serviço.",
      };
    }

    try {
      const data = await apiRequest<{
        request: RemoteServiceRequest;
        chat: ChatThread;
      }>(`/api/chats/${encodeURIComponent(chatId)}/start-service`, {
        method: "POST",
        token: state.sessionToken,
      });
      const nextRequest = mapRemoteActiveServiceRequest(data.request, state.activeServiceRequest);
      const nextChat = hydrateChat(data.chat);

      setState((current) => ({
        ...current,
        activeServiceRequest: nextRequest,
        activeChatId: nextChat.id,
        chats: upsertChatList(
          current.chats.filter((chat) => chat.id !== chatId),
          { ...nextChat, unread: 0 }
        ),
      }));

      return {
        ok: true,
        chatId: nextChat.id,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos fechar o serviço por este chat agora.",
      };
    }
  };

  const removeChatThread = (chatId: string) => {
    if (state.sessionToken) {
      void apiRequest(`/api/chats/${encodeURIComponent(chatId)}`, {
        method: "DELETE",
        token: state.sessionToken,
        suppressSystemStatus: true,
      }).catch(() => undefined);
    }

    setState((current) => ({
      ...current,
      chats: current.chats.filter((chat) => chat.id !== chatId),
      activeChatId: current.activeChatId === chatId ? null : current.activeChatId,
    }));
  };

  const declineContactRequest = async (chatId: string): Promise<Result> => {
    if (!state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos sua sessão para recusar a conversa.",
      };
    }

    try {
      await apiRequest(`/api/chats/${encodeURIComponent(chatId)}/decline-contact-request`, {
        method: "PATCH",
        token: state.sessionToken,
      });

      setState((current) => ({
        ...current,
        chats: current.chats.filter((chat) => chat.id !== chatId),
        activeChatId: current.activeChatId === chatId ? null : current.activeChatId,
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos recusar a conversa agora.",
      };
    }
  };

  const dismissNotification = (notificationId: string) => {
    const dismissedAt = nowIso();

    setState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              toastDismissedAt: dismissedAt,
            }
          : notification
      ),
    }));
  };

  const removeNotification = (notificationId: string) => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.filter((notification) => notification.id !== notificationId),
    }));
  };

  const markNotificationRead = (notificationId: string) => {
    const readAt = nowIso();

    setState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              readAt: notification.readAt ?? readAt,
              toastDismissedAt: notification.toastDismissedAt ?? readAt,
            }
          : notification
      ),
    }));
  };

  const markAllNotificationsRead = () => {
    const readAt = nowIso();

    setState((current) => ({
      ...current,
      notifications: current.notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? readAt,
        toastDismissedAt: notification.toastDismissedAt ?? readAt,
      })),
    }));
  };

  const clearReadNotifications = () => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.filter((notification) => !notification.readAt),
    }));
  };

  const reportChatConduct = async (
    chatId: string,
    { reason, details = "" }: { reason: string; details?: string }
  ): Promise<Result> => {
    const chat = state.chats.find((item) => item.id === chatId) ?? null;

    if (!isServerBackedChat(chat) || !state.sessionToken) {
      return {
        ok: false,
        error: "Não encontramos essa conversa para enviar a denúncia.",
      };
    }

    if (!reason.trim()) {
      return {
        ok: false,
        error: "Selecione o motivo da denúncia.",
      };
    }

    try {
      await apiRequest(`/api/chats/${chatId}/report`, {
        method: "POST",
        token: state.sessionToken,
        body: {
          reason,
          details,
        },
      });

      return {
        ok: true,
        message: "Denúncia enviada. A equipe Worko vai analisar a conversa.",
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos enviar a denúncia agora.",
      };
    }
  };

  const sendMessage = async (
    chatId: string,
    payload: string | ChatMessagePayload
  ): Promise<Result> => {
    const isImagePayload =
      typeof payload !== "string" && payload.messageType === "image" && Boolean(payload.imageUrl);
    const message = typeof payload === "string"
      ? payload.trim()
      : String(payload.body ?? payload.text ?? "").trim();

    if (!message && !isImagePayload) {
      return {
        ok: false,
        error: "Escreva uma mensagem antes de enviar.",
      };
    }

    if (message && containsExternalContact(message)) {
      return {
        ok: false,
        error: CHAT_EXTERNAL_CONTACT_WARNING,
      };
    }

    const chat = state.chats.find((item) => item.id === chatId) ?? null;

    if (!isServerBackedChat(chat) || !state.sessionToken) {
      return {
        ok: false,
        error: "Essa conversa não está conectada ao servidor. Atualize seus chats e tente novamente.",
      };
    }

    try {
      const data = await apiRequest<{ chat: ChatThread }>(`/api/chats/${chatId}/messages`, {
        method: "POST",
        token: state.sessionToken,
        body: isImagePayload
          ? {
              messageType: "image",
              imageUrl: payload.imageUrl,
              body: message,
            }
          : {
              body: message,
            },
      });

      setState((current) => ({
        ...current,
        chats: upsertChatList(current.chats, hydrateChat(data.chat)),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Não conseguimos enviar sua mensagem agora.",
      };
    }
  };

  const reopenChat = async (chatId: string): Promise<Result> => {
    const chat = state.chats.find((item) => item.id === chatId) ?? null;

    if (!isServerBackedChat(chat) || !state.sessionToken) {
      return {
        ok: false,
        error: "Essa conversa não está conectada ao servidor. Atualize seus chats e tente novamente.",
      };
    }

    try {
      const data = await apiRequest<{ chat: ChatThread }>(
        `/api/chats/${encodeURIComponent(chatId)}/reopen`,
        {
          method: "POST",
          token: state.sessionToken,
        }
      );

      setState((current) => ({
        ...current,
        activeChatId: chatId,
        chats: upsertChatList(current.chats, hydrateChat(data.chat)),
      }));

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não conseguimos reabrir esta conversa agora.",
      };
    }
  };

  const withErrorToast =
    <Args extends unknown[], R extends Result>(action: (...args: Args) => Promise<R>) =>
    async (...args: Args): Promise<R> => {
      const result = await action(...args);

      if (!result.ok && result.error) {
        dispatchSystemStatus({
          kind: "error",
          message: result.error,
        });
      }

      return result;
    };

  return (
    <AppContext.Provider
      value={{
        state,
        login: withErrorToast(login),
        completeGoogleLogin: withErrorToast(completeGoogleLogin),
        verifyDeviceLogin: withErrorToast(verifyDeviceLogin),
        cancelDeviceVerification,
        logout,
        deleteAccount: withErrorToast(deleteAccount),
        register: withErrorToast(register),
        requestVerificationCode: withErrorToast(requestVerificationCode),
        completeVerification: withErrorToast(completeVerification),
        finishProfileSetup: withErrorToast(finishProfileSetup),
        updateProfile: withErrorToast(updateProfile),
        submitProviderVerification: withErrorToast(submitProviderVerification),
        verifyCpf: withErrorToast(verifyCpf),
        addPost: withErrorToast(addPost),
        removePost: withErrorToast(removePost),
        createServiceRequest: withErrorToast(createServiceRequest),
        takeServiceRequest: withErrorToast(takeServiceRequest),
        refreshServicePins: withErrorToast(refreshServicePins),
        acceptWorkerInterest: withErrorToast(acceptWorkerInterest),
        declineWorkerInterest: withErrorToast(declineWorkerInterest),
        confirmServiceDeal,
        submitServiceDetails: withErrorToast(submitServiceDetails),
        advanceServiceToPayment: withErrorToast(advanceServiceToPayment),
        createServicePaymentSession: withErrorToast(createServicePaymentSession),
        refreshServicePaymentStatus: withErrorToast(refreshServicePaymentStatus),
        cancelActiveServiceRequest: withErrorToast(cancelActiveServiceRequest),
        deleteActiveServiceRequest: withErrorToast(deleteActiveServiceRequest),
        markServicePaid: withErrorToast(markServicePaid),
        markWorkerArrived: withErrorToast(markWorkerArrived),
        openServiceDispute: withErrorToast(openServiceDispute),
        reportProviderNoShow: withErrorToast(reportProviderNoShow),
        respondProviderNoShow: withErrorToast(respondProviderNoShow),
        releaseServicePayment: withErrorToast(releaseServicePayment),
        listCompletedServiceRequests,
        refreshSessionState: withErrorToast(refreshSessionState),
        completeAppTour,
        dismissNotification,
        removeNotification,
        markNotificationRead,
        markAllNotificationsRead,
        clearReadNotifications,
        openChat,
        openChatFromPost: withErrorToast(openChatFromPost),
        startServiceFromChat: withErrorToast(startServiceFromChat),
        clearActiveChat,
        declineContactRequest: withErrorToast(declineContactRequest),
        reopenChat: withErrorToast(reopenChat),
        removeChatThread,
        reportChatConduct: withErrorToast(reportChatConduct),
        sendMessage: withErrorToast(sendMessage),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
}




