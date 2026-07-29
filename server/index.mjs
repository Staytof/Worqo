import http from "node:http";
import { getAdminDashboard, assertAdminUser, updateAdminUserState } from "./admin.mjs";
import { config } from "./config.mjs";
import "./db.mjs";
import { processAsaasWebhookPayload, parseAsaasWebhookPayloadFromRawBody, createAsaasPaymentForServiceRequest, createPixWithdrawalForUser, getAsaasWalletSummaryForUser, notifyFreeWithdrawalAvailability, refreshAsaasPaymentForServiceRequest } from "./asaas.mjs";
import { geolocateWithGoogle } from "./google-geolocation.mjs";
import { consumePendingNotificationsForUser } from "./notifications.mjs";
import {
  beginObservedRequest,
  buildHealthSnapshot,
  recordBackgroundJobFailure,
  recordServerError,
  storeClientErrorReport,
} from "./observability.mjs";
import {
  getPushNotificationStatusForUser,
  registerPushTokenForUser,
  sendPushTestForUser,
  unregisterPushTokenForUser,
} from "./push-notifications.mjs";
import { assertRateLimit } from "./rate-limit.mjs";
import { tryServeBuiltApp } from "./static.mjs";
import {
  archiveCommunityChatForUser,
  archiveCommunityPostForUser,
  createCommunityPostForUser,
  declineCommunityContactRequestForUser,
  listCommunityChatsForUser,
  listCommunityPostsForUser,
  markCommunityChatReadForUser,
  openCommunityPostChatForUser,
  sendCommunityChatMessageForUser,
} from "./community-posts.mjs";
import {
  getPublicUserProfile,
  getSessionUser,
  completeGoogleOAuthLogin,
  createGoogleOAuthStartUrl,
  deleteUserAccount,
  loginUser,
  registerUser,
  revokeSession,
  sendVerificationCode,
  updateUserProfile,
  verifyAccount,
  verifyUserCpf,
} from "./auth-service.mjs";
import {
  HttpError,
  applySecurityHeaders,
  assertAllowedApiOrigin,
  getClientIp,
  getBearerToken,
  getRequestHeaderValue,
  json,
  readJsonBody,
  readRawBody,
  setCorsHeaders,
} from "./utils.mjs";
import { createId } from "./security.mjs";
import {
  acceptServiceRequestForUser,
  archiveServiceChatForUser,
  cancelServiceRequestForUser,
  confirmServiceRequestPaymentForUser,
  createServiceRequestForUser,
  deleteServiceRequestForUser,
  declineAssignedServiceRequestForUser,
  getActiveServiceRequestForUser,
  getPendingClientReviewForWorker,
  listCompletedServiceRequestsForUser,
  listPublicServiceRequests,
  listServiceChatsForUser,
  markServiceChatReadForUser,
  markServiceRequestPaidForUser,
  markServiceRequestWorkerArrivedForUser,
  openServiceRequestDisputeForUser,
  releaseServiceRequestPaymentForUser,
  reviewClientForCompletedServiceForUser,
  resolveServiceRequestDisputeForAdmin,
  sendServiceChatMessageForUser,
  startServiceRequestFromCommunityChatForUser,
  submitServiceRequestDetailsForUser,
  takeServiceRequestForUser,
} from "./service-requests.mjs";
import {
  closeSupportTicketForAdmin,
  getSupportTicketForUser,
  listSupportTicketsForAdmin,
  openSupportTicketForUser,
  reportChatConductForUser,
  sendSupportMessageForAdmin,
  sendSupportMessageForUser,
} from "./support.mjs";

function sortChatsByUpdatedAt(chats) {
  return [...chats].sort((left, right) => {
    const leftTime = new Date(left.updatedAt ?? 0).getTime();
    const rightTime = new Date(right.updatedAt ?? 0).getTime();
    return rightTime - leftTime;
  });
}

function requireSessionUser(request) {
  const token = getBearerToken(request);
  const user = getSessionUser(token);
  return { token, user };
}

function requireAdminSessionUser(request) {
  const session = requireSessionUser(request);
  assertAdminUser(session.user);
  return session;
}

function applyGlobalRateLimit(request) {
  const clientIp = getClientIp(request);
  assertRateLimit("api", clientIp, {
    max: config.rateLimit.apiMax,
    windowMs: config.rateLimit.apiWindowMs,
    message: "Muitas requisições em pouco tempo. Aguarde um instante e tente de novo.",
  });
}

function applyAuthRateLimit(request, suffix) {
  const clientIp = getClientIp(request);
  assertRateLimit(`auth:${suffix}`, clientIp, {
    max: config.rateLimit.authMax,
    windowMs: config.rateLimit.authWindowMs,
    message: "Você tentou autenticar muitas vezes. Aguarde alguns minutos para tentar novamente.",
  });
}

function redirect(response, location) {
  response.writeHead(302, {
    ...response.getHeaders(),
    "Cache-Control": "no-store",
    Location: location,
  });
  response.end();
}

function buildGoogleAuthReturnUrl(params, returnTo = "") {
  const returnUrl = new URL(returnTo || config.appBaseUrl || "http://localhost:5173");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      returnUrl.searchParams.set(key, String(value));
    }
  }

  return returnUrl.toString();
}

function applyChatRateLimit(request) {
  const clientIp = getClientIp(request);
  assertRateLimit("chat", clientIp, {
    max: config.rateLimit.chatMax,
    windowMs: config.rateLimit.chatWindowMs,
    message: "Muitas mensagens em pouco tempo. Aguarde um instante antes de enviar outra.",
  });
}

function parseReleaseVersionIdentifier(value) {
  const normalizedValue = String(value ?? "").trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  const dateMatch = normalizedValue.match(/^(\d{8})(?:[-_]?(.+))?$/);

  if (dateMatch) {
    return {
      kind: "date",
      parts: [Number(dateMatch[1])],
      normalizedValue,
    };
  }

  const semverMatch = normalizedValue.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-_]?(.+))?$/);

  if (semverMatch) {
    return {
      kind: "semver",
      parts: [
        Number(semverMatch[1]),
        Number(semverMatch[2]),
        Number(semverMatch[3]),
      ],
      normalizedValue,
    };
  }

  return {
    kind: "raw",
    parts: [],
    normalizedValue,
  };
}

function compareReleaseIdentifiers(clientRelease, requiredRelease) {
  const clientVersion = parseReleaseVersionIdentifier(clientRelease);
  const requiredVersion = parseReleaseVersionIdentifier(requiredRelease);

  if (!clientVersion || !requiredVersion) {
    return false;
  }

  if (clientVersion.normalizedValue === requiredVersion.normalizedValue) {
    return true;
  }

  if (clientVersion.kind !== requiredVersion.kind) {
    return false;
  }

  if (clientVersion.kind === "raw") {
    return false;
  }

  const maxLength = Math.max(clientVersion.parts.length, requiredVersion.parts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const clientPart = clientVersion.parts[index] ?? 0;
    const requiredPart = requiredVersion.parts[index] ?? 0;

    if (clientPart > requiredPart) {
      return true;
    }

    if (clientPart < requiredPart) {
      return false;
    }
  }

  return true;
}

function assertSupportedClientRelease(request, pathname) {
  if (!config.requiredClientRelease) {
    return;
  }

  if (
    pathname === "/api/health" ||
    pathname === "/api/client-errors" ||
    pathname === "/api/asaas/webhook" ||
    pathname === "/api/auth/google/start" ||
    pathname === "/api/auth/google/callback"
  ) {
    return;
  }

  const clientRelease = getRequestHeaderValue(request, "x-worqo-client-release");

  if (compareReleaseIdentifiers(clientRelease, config.requiredClientRelease)) {
    return;
  }

  throw new HttpError(
    426,
    "Este aplicativo está desatualizado. Instale a versão mais recente para continuar.",
    {
      requiredClientRelease: config.requiredClientRelease,
    }
  );
}

const SMALL_JSON_BODY_OPTIONS = { maxBytes: 32 * 1024 };
const MEDIUM_JSON_BODY_OPTIONS = { maxBytes: 64 * 1024 };
const PROFILE_JSON_BODY_OPTIONS = { maxBytes: 1024 * 1024 };
const WEBHOOK_JSON_BODY_OPTIONS = { maxBytes: 512 * 1024 };

const server = http.createServer(async (request, response) => {
  applySecurityHeaders(response);
  setCorsHeaders(request, response, config.clientOrigins, request.headers.origin ?? "");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const isAsaasWebhookRoute = url.pathname === "/api/asaas/webhook";
  const requestId = createId();
  const observedRequest = beginObservedRequest({
    requestId,
    method: request.method ?? "GET",
    pathname: url.pathname,
  });
  let serverErrorRecorded = false;

  response.setHeader("X-Request-Id", requestId);

  if (config.requiredClientRelease) {
    response.setHeader("X-Worqo-Required-Client-Release", config.requiredClientRelease);
  }

  response.once("finish", () => {
    if (serverErrorRecorded || (response.statusCode ?? 200) < 500) {
      return;
    }

    recordServerError(observedRequest, new Error(`HTTP ${response.statusCode}`), {
      statusCode: response.statusCode,
    });
  });

  try {
    if (url.pathname.startsWith("/api/") && !isAsaasWebhookRoute) {
      assertAllowedApiOrigin(request, config.clientOrigins, request.headers.origin ?? "");
      assertSupportedClientRelease(request, url.pathname);
    }

    if (request.method === "GET" && url.pathname === "/api/asaas/webhook") {
      json(response, 200, {
        ok: true,
        message:
          "Endpoint Asaas webhook ativo. Use POST assinado pelo token do Asaas para enviar eventos.",
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/asaas/webhook") {
      const rawBody = await readRawBody(request, WEBHOOK_JSON_BODY_OPTIONS);
      const payload = parseAsaasWebhookPayloadFromRawBody(rawBody);
      const headerToken =
        typeof request.headers["asaas-access-token"] === "string"
          ? request.headers["asaas-access-token"]
          : typeof request.headers["asaas_access_token"] === "string"
            ? request.headers["asaas_access_token"]
            : "";
      const webhookEventType = String(payload?.event ?? payload?.type ?? "asaas.unknown");
      const webhookEntityId =
        payload?.payment?.id ?? payload?.transfer?.id ?? payload?.id ?? "unknown";
      let webhookResult;

      try {
        webhookResult = await processAsaasWebhookPayload(payload, headerToken);
      } catch (error) {
        if (error instanceof HttpError) {
          console.warn("Asaas webhook rejected", {
            statusCode: error.statusCode,
            message: error.message,
            webhookEventType,
            webhookEntityId,
          });
        }

        throw error;
      }

      json(response, 200, webhookResult.response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      json(response, 200, buildHealthSnapshot());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/client-errors") {
      const body = await readJsonBody(request, MEDIUM_JSON_BODY_OPTIONS);
      let userId = null;

      try {
        const token = getBearerToken(request);
        userId = token ? getSessionUser(token).id : null;
      } catch {
        userId = null;
      }

      const result = storeClientErrorReport(body, {
        requestId,
        userId,
      });

      json(response, 202, {
        ok: true,
        reportId: result.id,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/location/geolocate") {
      const location = await geolocateWithGoogle();
      json(response, 200, location);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register") {
      applyAuthRateLimit(request, "register");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const pendingUser = await registerUser(body);
      json(response, 201, pendingUser);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/send-verification") {
      applyAuthRateLimit(request, "send-verification");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const delivery = await sendVerificationCode({
        userId: body.userId,
      });
      json(response, 200, delivery);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/verify") {
      applyAuthRateLimit(request, "verify");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const session = verifyAccount({
        code: body.code,
        userId: body.userId,
        acceptTerms: body.acceptTerms,
        acceptPrivacy: body.acceptPrivacy,
        legalVersion: body.legalVersion,
      });
      json(response, 200, session);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/google/start") {
      applyAuthRateLimit(request, "google-start");
      const returnTo = url.searchParams.get("returnTo") || "";

      try {
        const googleUrl = createGoogleOAuthStartUrl({
          rememberMe: url.searchParams.get("rememberMe") !== "false",
          returnTo,
        });
        redirect(response, googleUrl);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não conseguimos iniciar o login com Google agora.";

        redirect(
          response,
          buildGoogleAuthReturnUrl({
            googleError: message,
          }, returnTo)
        );
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/google/callback") {
      applyAuthRateLimit(request, "google-callback");

      try {
        const session = await completeGoogleOAuthLogin({
          code: url.searchParams.get("code"),
          state: url.searchParams.get("state"),
        });

        redirect(
          response,
          buildGoogleAuthReturnUrl({
            googleToken: session.token || undefined,
            googlePending: session.pendingVerification
              ? JSON.stringify(session.pendingVerification)
              : undefined,
            googleRemember: session.rememberMe ? "1" : "0",
          }, session.returnTo)
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não conseguimos entrar com Google agora.";

        redirect(
          response,
          buildGoogleAuthReturnUrl({
            googleError: message,
          })
        );
      }

      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      applyAuthRateLimit(request, "login");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const session = loginUser(body);
      json(response, 200, session);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      const token = getBearerToken(request);
      const user = getSessionUser(token);
      json(response, 200, { user });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      const token = getBearerToken(request);
      revokeSession(token);
      json(response, 200, { ok: true });
      return;
    }

    if (request.method === "DELETE" && url.pathname === "/api/me/account") {
      const { user } = requireSessionUser(request);
      const result = deleteUserAccount(user.id);
      json(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/wallet") {
      const { user } = requireSessionUser(request);
      const wallet = await getAsaasWalletSummaryForUser(user.id);
      json(response, 200, { wallet });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/wallet/withdraw") {
      const { user } = requireSessionUser(request);
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const result = await createPixWithdrawalForUser(user.id, {
        mode: body.mode,
      });
      json(response, 200, result);
      return;
    }

    if (request.method === "PATCH" && url.pathname === "/api/me/profile") {
      const { user } = requireSessionUser(request);
      const body = await readJsonBody(request, PROFILE_JSON_BODY_OPTIONS);
      const updatedUser = updateUserProfile(user.id, body);
      json(response, 200, { user: updatedUser });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/push/register") {
      const { user } = requireSessionUser(request);
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const result = registerPushTokenForUser(user.id, body);
      json(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/push/unregister") {
      const { user } = requireSessionUser(request);
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const result = unregisterPushTokenForUser(user.id, body);
      json(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/me/push/status") {
      const { user } = requireSessionUser(request);
      json(response, 200, {
        push: getPushNotificationStatusForUser(user.id),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/push/test") {
      const { user } = requireSessionUser(request);
      const result = await sendPushTestForUser(user.id);
      json(response, result.ok ? 200 : 503, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/me/cpf/verify") {
      const { user } = requireSessionUser(request);
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const updatedUser = await verifyUserCpf(user.id, body.cpf);
      json(response, 200, { user: updatedUser });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/service-requests") {
      const { user } = requireSessionUser(request);
      const requests = listPublicServiceRequests(user.id);
      json(response, 200, { requests });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/service-requests/active") {
      const { user } = requireSessionUser(request);
      const activeRequest = getActiveServiceRequestForUser(user.id);
      json(response, 200, { request: activeRequest });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/service-requests/history") {
      const { user } = requireSessionUser(request);
      const requests = listCompletedServiceRequestsForUser(user.id);
      json(response, 200, { requests });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/service-requests/pending-client-review") {
      const { user } = requireSessionUser(request);
      const pendingRequest = getPendingClientReviewForWorker(user.id);
      json(response, 200, { request: pendingRequest });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/dashboard") {
      requireAdminSessionUser(request);
      json(response, 200, getAdminDashboard());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/support/tickets") {
      requireAdminSessionUser(request);
      json(response, 200, {
        tickets: listSupportTicketsForAdmin(),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/support/ticket") {
      const { user } = requireSessionUser(request);
      json(response, 200, {
        ticket: getSupportTicketForUser(user.id),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/support/ticket") {
      const { user } = requireSessionUser(request);
      json(response, 201, {
        ticket: openSupportTicketForUser(user.id),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/service-requests") {
      const { user } = requireSessionUser(request);
      const body = await readJsonBody(request, MEDIUM_JSON_BODY_OPTIONS);
      const createdRequest = createServiceRequestForUser(user, body);
      json(response, 201, { request: createdRequest });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/posts") {
      const { user } = requireSessionUser(request);
      const posts = listCommunityPostsForUser(user.id);
      json(response, 200, { posts });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/posts") {
      const { user } = requireSessionUser(request);
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const post = createCommunityPostForUser(user, body);
      json(response, 201, { post });
      return;
    }

    const deleteCommunityPostMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);

    if (request.method === "DELETE" && deleteCommunityPostMatch) {
      const { user } = requireSessionUser(request);
      const postId = decodeURIComponent(deleteCommunityPostMatch[1]);
      const result = archiveCommunityPostForUser(user.id, postId);
      json(response, 200, result);
      return;
    }

    const openCommunityPostChatMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/chat$/);

    if (request.method === "POST" && openCommunityPostChatMatch) {
      const { user } = requireSessionUser(request);
      const postId = decodeURIComponent(openCommunityPostChatMatch[1]);
      const result = openCommunityPostChatForUser(user.id, postId);
      json(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/chats") {
      const { user } = requireSessionUser(request);
      const chats = sortChatsByUpdatedAt([
        ...listServiceChatsForUser(user.id),
        ...listCommunityChatsForUser(user.id),
      ]);
      json(response, 200, { chats });
      return;
    }

    const archiveChatMatch = url.pathname.match(/^\/api\/chats\/([^/]+)$/);

    if (request.method === "DELETE" && archiveChatMatch) {
      const { user } = requireSessionUser(request);
      const chatId = decodeURIComponent(archiveChatMatch[1]);
      let result;

      try {
        result = archiveServiceChatForUser(user.id, chatId);
      } catch (error) {
        if (!(error instanceof HttpError) || error.statusCode !== 404) {
          throw error;
        }

        result = archiveCommunityChatForUser(user.id, chatId);
      }

      json(response, 200, result);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/notifications/consume") {
      const { user } = requireSessionUser(request);
      const notifications = consumePendingNotificationsForUser(user.id);
      json(response, 200, { notifications });
      return;
    }

    const publicProfileMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/profile$/);

    if (request.method === "GET" && publicProfileMatch) {
      requireSessionUser(request);
      const targetUserId = decodeURIComponent(publicProfileMatch[1]);
      const profile = getPublicUserProfile(targetUserId);
      json(response, 200, { profile });
      return;
    }

    const deleteServiceRequestMatch = url.pathname.match(/^\/api\/service-requests\/([^/]+)$/);

    if (request.method === "DELETE" && deleteServiceRequestMatch) {
      const { user } = requireSessionUser(request);
      const requestId = deleteServiceRequestMatch[1];
      const result = await deleteServiceRequestForUser(user.id, requestId);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/dispute")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/dispute", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const updatedRequest = openServiceRequestDisputeForUser(user.id, requestId, body);
      json(response, 200, { request: updatedRequest });
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/take")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/take", "")
        .replace(/\/$/, "");
      const acceptedRequest = takeServiceRequestForUser(user.id, requestId);
      json(response, 200, { request: acceptedRequest });
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/accept")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/accept", "")
        .replace(/\/$/, "");
      const acceptedRequest = acceptServiceRequestForUser(user.id, requestId);
      json(response, 200, acceptedRequest);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/decline")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/decline", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const declinedRequest = declineAssignedServiceRequestForUser(user.id, requestId, {
        blockWorkerForTenMinutes: Boolean(body?.blockWorkerForTenMinutes),
      });
      json(response, 200, { request: declinedRequest });
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/details")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/details", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, MEDIUM_JSON_BODY_OPTIONS);
      const updatedRequest = submitServiceRequestDetailsForUser(user.id, requestId, body);
      json(response, 200, { request: updatedRequest });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/payment-session")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/payment-session", "")
        .replace(/\/$/, "");
      const paymentSession = await createAsaasPaymentForServiceRequest(user.id, requestId);
      json(response, 200, paymentSession);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/payment-ready")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/payment-ready", "")
        .replace(/\/$/, "");
      const updatedRequest = confirmServiceRequestPaymentForUser(user.id, requestId);
      json(response, 200, { request: updatedRequest });
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/mark-paid")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/mark-paid", "")
        .replace(/\/$/, "");
      const result = await markServiceRequestPaidForUser(user.id, requestId);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/worker-arrived")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/worker-arrived", "")
        .replace(/\/$/, "");
      const result = markServiceRequestWorkerArrivedForUser(user.id, requestId);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/payment-status")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/payment-status", "")
        .replace(/\/$/, "");
      const result = await refreshAsaasPaymentForServiceRequest(user.id, requestId);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/admin/users/") &&
      url.pathname.endsWith("/state")
    ) {
      requireAdminSessionUser(request);
      const userId = url.pathname
        .replace("/api/admin/users/", "")
        .replace("/state", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const updatedUser = updateAdminUserState(userId, {
        action: body.action,
        reason: body.reason,
      });
      json(response, 200, { user: updatedUser });
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/admin/service-requests/") &&
      url.pathname.endsWith("/resolve-dispute")
    ) {
      const { user } = requireAdminSessionUser(request);
      const requestId = url.pathname
        .replace("/api/admin/service-requests/", "")
        .replace("/resolve-dispute", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const result = await resolveServiceRequestDisputeForAdmin(user.id, requestId, body);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/admin/support/tickets/") &&
      url.pathname.endsWith("/messages")
    ) {
      applyChatRateLimit(request);
      const { user } = requireAdminSessionUser(request);
      const ticketId = url.pathname
        .replace("/api/admin/support/tickets/", "")
        .replace("/messages", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const ticket = sendSupportMessageForAdmin(user.id, ticketId, body.body);
      json(response, 201, { ticket });
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/admin/support/tickets/") &&
      url.pathname.endsWith("/close")
    ) {
      const { user } = requireAdminSessionUser(request);
      const ticketId = url.pathname
        .replace("/api/admin/support/tickets/", "")
        .replace("/close", "")
        .replace(/\/$/, "");
      const ticket = closeSupportTicketForAdmin(user.id, ticketId);
      json(response, 200, { ticket });
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/release-payment")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/release-payment", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const result = await releaseServiceRequestPaymentForUser(user.id, requestId, body);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/review-client")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/review-client", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const result = reviewClientForCompletedServiceForUser(user.id, requestId, body);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/service-requests/") &&
      url.pathname.endsWith("/cancel")
    ) {
      const { user } = requireSessionUser(request);
      const requestId = url.pathname
        .replace("/api/service-requests/", "")
        .replace("/cancel", "")
        .replace(/\/$/, "");
      const result = await cancelServiceRequestForUser(user.id, requestId);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/chats/") &&
      url.pathname.endsWith("/read")
    ) {
      const { user } = requireSessionUser(request);
      const chatId = url.pathname
        .replace("/api/chats/", "")
        .replace("/read", "")
        .replace(/\/$/, "");
      let chat;

      try {
        chat = markServiceChatReadForUser(user.id, chatId);
      } catch (error) {
        if (!(error instanceof HttpError) || error.statusCode !== 404) {
          throw error;
        }

        chat = markCommunityChatReadForUser(user.id, chatId);
      }

      json(response, 200, { chat });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/chats/") &&
      url.pathname.endsWith("/report")
    ) {
      applyChatRateLimit(request);
      const { user } = requireSessionUser(request);
      const chatId = url.pathname
        .replace("/api/chats/", "")
        .replace("/report", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      let chat;

      try {
        chat = markServiceChatReadForUser(user.id, chatId);
      } catch (error) {
        if (!(error instanceof HttpError) || error.statusCode !== 404) {
          throw error;
        }

        chat = markCommunityChatReadForUser(user.id, chatId);
      }

      const report = reportChatConductForUser(user.id, chat, body);
      json(response, 201, report);
      return;
    }

    if (
      request.method === "PATCH" &&
      url.pathname.startsWith("/api/chats/") &&
      url.pathname.endsWith("/decline-contact-request")
    ) {
      const { user } = requireSessionUser(request);
      const chatId = url.pathname
        .replace("/api/chats/", "")
        .replace("/decline-contact-request", "")
        .replace(/\/$/, "");
      const result = declineCommunityContactRequestForUser(user.id, chatId);
      json(response, 200, result);
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/chats/") &&
      url.pathname.endsWith("/start-service")
    ) {
      const { user } = requireSessionUser(request);
      const chatId = url.pathname
        .replace("/api/chats/", "")
        .replace("/start-service", "")
        .replace(/\/$/, "");
      const result = startServiceRequestFromCommunityChatForUser(user, decodeURIComponent(chatId));
      json(response, 201, result);
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/chats/") &&
      url.pathname.endsWith("/messages")
    ) {
      applyChatRateLimit(request);
      const { user } = requireSessionUser(request);
      const chatId = url.pathname
        .replace("/api/chats/", "")
        .replace("/messages", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, PROFILE_JSON_BODY_OPTIONS);
      let chat;

      try {
        chat = sendServiceChatMessageForUser(user.id, chatId, body);
      } catch (error) {
        if (!(error instanceof HttpError) || error.statusCode !== 404) {
          throw error;
        }

        chat = sendCommunityChatMessageForUser(user.id, chatId, body);
      }

      json(response, 201, { chat });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname.startsWith("/api/support/tickets/") &&
      url.pathname.endsWith("/messages")
    ) {
      applyChatRateLimit(request);
      const { user } = requireSessionUser(request);
      const ticketId = url.pathname
        .replace("/api/support/tickets/", "")
        .replace("/messages", "")
        .replace(/\/$/, "");
      const body = await readJsonBody(request, SMALL_JSON_BODY_OPTIONS);
      const ticket = sendSupportMessageForUser(user.id, ticketId, body.body);
      json(response, 201, { ticket });
      return;
    }

    if (request.method === "GET") {
      const servedApp = await tryServeBuiltApp(response, url.pathname);

      if (servedApp) {
        return;
      }
    }

    json(response, 404, { error: "Rota não encontrada." });
  } catch (error) {
    if (error instanceof HttpError) {
      const trackedError =
        error.statusCode >= 500
          ? recordServerError(observedRequest, error, { statusCode: error.statusCode })
          : null;
      serverErrorRecorded = Boolean(trackedError);

      json(response, error.statusCode, {
        error: error.message,
        requestId,
        ...(trackedError ? { errorId: trackedError.errorId } : {}),
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }

    const trackedError = recordServerError(observedRequest, error, { statusCode: 500 });
    serverErrorRecorded = true;
    console.error(error);
    json(response, 500, {
      error: "Erro interno do servidor.",
      requestId,
      errorId: trackedError.errorId,
    });
  }
});

const FREE_WITHDRAWAL_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function startBackgroundJobs() {
  try {
    notifyFreeWithdrawalAvailability();
  } catch (error) {
    recordBackgroundJobFailure("notifyFreeWithdrawalAvailability", error);
    console.warn("Falha ao iniciar a varredura de saques grátis disponíveis.", error);
  }

  setInterval(() => {
    try {
      notifyFreeWithdrawalAvailability();
    } catch (error) {
      recordBackgroundJobFailure("notifyFreeWithdrawalAvailability", error);
      console.warn("Falha ao varrer saques grátis disponíveis.", error);
    }
  }, FREE_WITHDRAWAL_SWEEP_INTERVAL_MS).unref?.();
}

startBackgroundJobs();

server.listen(config.port, () => {
  console.log(`Worko auth API disponível em http://localhost:${config.port}`);
});


