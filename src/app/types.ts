export type OnboardingStep = "login" | "verify" | "profile-setup" | "app";

export type VerificationMethod = "email";

export type ThemePreference = "light";

export type AccountKind = "client" | "provider";

export type PinType = "Conserto" | "Limpeza" | "Freelas";

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export type PostType = "offer" | "request";

export type MessageStatus = "sent" | "delivered" | "read";

export type ServiceRequestStatus =
  | "searching"
  | "assigned"
  | "interest-received"
  | "chatting"
  | "details"
  | "waiting-worker"
  | "payment"
  | "confirmed"
  | "completed";

export type ServiceLocationMode = "residence" | "street";

export type RegistrationDraft = {
  fullName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  birthDate: string;
  password: string;
};

export type PendingVerification = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
};

export type ServiceReview = {
  id: string;
  rating: number;
  comment: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar: string | null;
  serviceTitle: string;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  accountKind: AccountKind | null;
  phone: string;
  birthDate: string;
  avatar: string | null;
  headline: string;
  bio: string;
  professions: string[];
  skills: string[];
  availabilityNote: string;
  cpf: string;
  address: string;
  certificates: string[];
  isAccountVerified: boolean;
  isCpfVerified: boolean;
  cpfVerifiedAt: string | null;
  cpfVerificationProvider: string | null;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  legalAcceptedVersion: string | null;
  verifiedChannel: VerificationMethod | null;
  emailVerifiedAt: string | null;
  hasCompletedProfileSetup: boolean;
  pixKeyType: PixKeyType | null;
  pixKey: string;
  hasPixKeyConfigured: boolean;
  canReceivePixTransfers: boolean;
  isAdmin: boolean;
  isSuspended?: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  identityLockedAt: string | null;
  completedServicesCount: number;
  averageRating: number | null;
  reviewsCount: number;
  recentReviews: ServiceReview[];
  createdAt: string;
};

export type ServiceTimelineEvent = {
  id: string;
  kind: string;
  actorRole: "requester" | "worker" | "admin" | "system";
  title: string;
  description: string;
  createdAt: string;
};

export type ServiceDispute = {
  status: "open" | "resolved" | "refunded" | null;
  reason: string;
  openedAt: string | null;
  openedByUserId: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  adminNote: string | null;
};

export type ServicePaymentSnapshot = {
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  currency: string;
  providerStatus: string | null;
  receivedAt: string | null;
};

export type ServicePin = {
  id: string;
  type: PinType;
  requesterId: string;
  requesterName: string;
  isVerified: boolean;
  description: string;
  latitude: number;
  longitude: number;
  maskedLatitude: number;
  maskedLongitude: number;
  maskedRadiusMeters: number;
  exactLocationVisible: boolean;
  accuracy: number | null;
  locationLabel: string | null;
  status: ServiceRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type Post = {
  id: string;
  user: string;
  isVerified: boolean;
  type: PostType;
  category: PinType;
  content: string;
  profession?: string;
  experience?: string;
  durationDays?: number;
  expiresAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  avatar?: string | null;
  timeLabel: string;
  distance: string;
  chatId: string | null;
  authorId: "community" | "me";
};

export type Message = {
  id: string;
  sender: "me" | "contact";
  text: string;
  messageType?: "text" | "image";
  imageUrl?: string | null;
  timestamp: string;
  status: MessageStatus;
};

export type WorkerProfile = {
  id: string;
  name: string;
  accent: "blue" | "emerald" | "amber" | "slate";
  isVerified: boolean;
  category: PinType;
  rating: number;
  completedServices: number;
  bio: string;
  professions: string[];
  skills: string[];
  servicePitch: string;
  avatar: string | null;
};

export type PublicUserProfile = {
  id: string;
  fullName: string;
  accountKind?: AccountKind | null;
  avatar: string | null;
  headline: string;
  bio: string;
  professions: string[];
  skills: string[];
  availabilityNote: string;
  certificates: string[];
  isAccountVerified: boolean;
  isCpfVerified: boolean;
  completedServicesCount: number;
  averageRating: number | null;
  reviewsCount: number;
  recentReviews: ServiceReview[];
  createdAt: string;
};

export type ChatThread = {
  id: string;
  name: string;
  avatar: string | null;
  contactUserId?: string | null;
  updatedAt?: string | null;
  isOnline: boolean;
  isVerified: boolean;
  role: string;
  unread: number;
  accent: "blue" | "emerald" | "amber" | "slate";
  messages: Message[];
  serviceRequestId?: string | null;
  serviceType?: PinType | null;
  servicePreview?: string | null;
};

export type SupportTicketStatus = "waiting" | "active" | "closed";

export type SupportTicketMessage = {
  id: string;
  senderUserId: string;
  senderRole: "requester" | "admin";
  senderName: string;
  senderAvatar: string | null;
  body: string;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lastCustomerMessageAt: string | null;
  lastAdminMessageAt: string | null;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  requesterAvatar: string | null;
  assignedAdminUserId: string | null;
  assignedAdminName: string | null;
  assignedAdminAvatar: string | null;
  queueAheadCount: number;
  messages: SupportTicketMessage[];
};

export type ActiveServiceRequest = {
  id: string;
  type: PinType;
  description: string;
  createdAt: string;
  createdAtLabel: string;
  status: ServiceRequestStatus;
  currentUserRole: "requester" | "worker";
  requesterId: string;
  requesterName: string;
  requesterVerified: boolean;
  latitude: number;
  longitude: number;
  maskedLatitude: number;
  maskedLongitude: number;
  maskedRadiusMeters: number;
  exactLocationVisible: boolean;
  accuracy: number | null;
  locationLabel: string | null;
  workerId: string | null;
  workerName: string | null;
  workerVerified: boolean;
  acceptedAt: string | null;
  chatId: string | null;
  dismissedWorkerIds: string[];
  payment: ServicePaymentSnapshot | null;
  dispute: ServiceDispute | null;
  timeline: ServiceTimelineEvent[];
  details: {
    title: string;
    price: string;
    serviceDate: string;
    schedule: string;
    delayToleranceMinutes: number;
    locationMode: ServiceLocationMode;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    locationLabel?: string | null;
  } | null;
};

export type AppNotification = {
  id: string;
  kind:
    | "chat-message"
    | "chat-request"
    | "chat-request-declined"
    | "support-message"
    | "service-interest"
    | "service-cancelled"
    | "requester-continued-search"
    | "service-accepted"
    | "service-details-sent"
    | "payment-ready"
    | "payment-confirmed"
    | "wallet-available"
    | "wallet-free-ready"
    | "notifications-reminder"
    | "withdrawal-done"
    | "withdrawal-failed"
    | "dispute-opened"
    | "dispute-resolved";
  message: string;
  title?: string | null;
  avatar?: string | null;
  chatId?: string | null;
  path?: string | null;
  ticketId?: string | null;
  createdAt: string;
  readAt?: string | null;
  toastDismissedAt?: string | null;
};

export type AppState = {
  authReady: boolean;
  onboardingStep: OnboardingStep;
  isAuthenticated: boolean;
  rememberSession: boolean;
  themePreference: ThemePreference;
  sessionToken: string | null;
  pendingVerification: PendingVerification | null;
  user: UserProfile | null;
  pins: ServicePin[];
  posts: Post[];
  chats: ChatThread[];
  notifications: AppNotification[];
  activeChatId: string | null;
  activeServiceRequest: ActiveServiceRequest | null;
};

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type PostComposerPayload = {
  type: PostType;
  category: PinType;
  content: string;
  profession?: string;
  experience?: string;
  durationDays?: number;
  expiresAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ServiceRequestComposerPayload = {
  type: PinType;
  description: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  locationLabel?: string;
};

export type ServiceDetailsPayload = {
  title: string;
  price: string;
  serviceDate: string;
  schedule: string;
  delayToleranceMinutes: number;
  locationMode: ServiceLocationMode;
  address: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  locationLabel?: string | null;
};

export type ServiceReviewPayload = {
  rating: number;
  comment: string;
};

export type WalletEntryStatus =
  | "awaiting-client-payment"
  | "held-for-service"
  | "available-for-withdrawal"
  | "withdrawal-in-progress"
  | "withdrawn-via-pix"
  | "awaiting-worker-confirmation"
  | "in-progress";

export type WorkerWalletEntry = {
  id: string;
  type: PinType;
  description: string;
  requesterName: string;
  netAmountCents: number;
  feeAmountCents: number;
  grossAmountCents: number;
  status: WalletEntryStatus;
  createdAt: string;
  updatedAt: string;
  releasedAt: string | null;
  freeWithdrawalAvailableAt?: string | null;
};

export type WorkerWithdrawalRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  providerTransferId: string;
  mode: "instant" | "standard";
  grossAmountCents: number;
  feeAmountCents: number;
  amountCents: number;
  currency: string;
  status: string;
  pixKeyType: PixKeyType | null;
  pixKeyMasked: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkerWalletSummary = {
  hasPixKeyConfigured: boolean;
  canReceivePixTransfers: boolean;
  pixKeyMatchesCpf: boolean;
  pixKeyType: PixKeyType | null;
  pixKey: string;
  awaitingClientPaymentCents: number;
  heldForServiceCents: number;
  availableToWithdrawCents: number;
  availableForStandardWithdrawalCents: number;
  instantWithdrawalFeeCents: number;
  providerAvailableBalanceCents: number | null;
  instantAvailableNowCents: number;
  standardAvailableNowCents: number;
  nextFreeWithdrawalAvailableAt?: string | null;
  providerBalanceShortfallCents: number;
  providerBalanceMessage: string | null;
  providerBalanceSyncedAt: string | null;
  processingWithdrawalsCents: number;
  recentEntries: WorkerWalletEntry[];
  recentWithdrawals: WorkerWithdrawalRecord[];
};

export type AdminServiceRequestRecord = {
  id: string;
  category: PinType;
  agreementTitle: string;
  description: string;
  status: string;
  requesterName: string;
  requesterEmail: string;
  workerName: string | null;
  workerEmail: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  locationLabel: string | null;
  createdAt: string;
  updatedAt: string;
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  paymentStatus: string | null;
  dispute: ServiceDispute | null;
  timeline: ServiceTimelineEvent[];
};

export type AdminOverview = {
  totalUsers: number;
  newUsers7d: number;
  verifiedUsers: number;
  emailVerifiedUsers: number;
  profileCompletedUsers: number;
  activeUsers24h: number;
  openRequests: number;
  openMapRequests: number;
  confirmedServices: number;
  openDisputes: number;
  supportOpenTickets: number;
  pendingWithdrawals: number;
  grossVolumeCents: number;
  feeVolumeCents: number;
};

export type AdminRequestStatusCount = {
  status: string;
  total: number;
};

export type AdminUserRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  avatar: string | null;
  headline: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
  verifiedChannel: string | null;
  emailVerifiedAt: string | null;
  cpfVerifiedAt: string | null;
  profileCompletedAt: string | null;
  hasPixKeyConfigured: boolean;
  isAdmin: boolean;
  isFlagged: boolean;
  flaggedAt: string | null;
  flagReason: string | null;
  isSuspended: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  requestsCreatedCount: number;
  jobsTakenCount: number;
  completedServicesCount: number;
  openSupportTickets: number;
  activeServiceFlows: number;
};

export type AdminSupportOverview = {
  totalTickets: number;
  waitingTickets: number;
  activeTickets: number;
  closedTickets: number;
  latestOpenedAt: string | null;
  latestCustomerMessageAt: string | null;
};

export type AdminHealthSnapshot = {
  ok: boolean;
  service: string;
  time: string;
  uptimeSeconds: number;
  release: {
    backend: string | null;
    requiredClientRelease: string | null;
  };
  support: {
    email: string | null;
    whatsapp: string | null;
  };
  integrations: {
    asaasConfigured: boolean;
    mapsConfigured: boolean;
    emailConfigured: boolean;
    fcmConfigured: boolean;
    cpfProvider: string | null;
    cpfConfigured: boolean;
  };
  metrics: {
    totalRequests: number;
    totalServerErrors: number;
    totalClientReports: number;
    clientReportsStored: number;
    errorRate: number;
    lastRequestAt: string | null;
    lastServerErrorAt: string | null;
    recentErrors: Array<{
      id: string;
      type: string;
      createdAt: string;
      requestId: string | null;
      method: string | null;
      pathname: string | null;
      message: string;
      name: string;
      statusCode: number | null;
    }>;
  };
};

export type AdminDashboard = {
  overview: AdminOverview;
  requestStatusCounts: AdminRequestStatusCount[];
  requests: AdminServiceRequestRecord[];
  users: AdminUserRecord[];
  supportOverview: AdminSupportOverview;
  withdrawals: WorkerWithdrawalRecord[];
};
