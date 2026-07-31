import nodemailer from "nodemailer";
import { config, isEmailConfigured } from "../config.mjs";
import { buildServicePaymentReceiptPdf } from "./pdf-provider.mjs";
import { HttpError } from "../utils.mjs";

let transporter;

function extractEmailAddress(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/<([^>]+)>/);
  return String(match?.[1] ?? text).trim().toLowerCase();
}

function getMailIdentity() {
  const smtpUser = String(config.smtp.user ?? "").trim();
  const configuredFrom = String(config.smtp.from ?? "").trim();
  const configuredFromEmail = extractEmailAddress(configuredFrom);
  const smtpUserEmail = smtpUser.toLowerCase();

  if (configuredFrom && configuredFromEmail === smtpUserEmail) {
    return { from: configuredFrom };
  }

  return {
    from: `Worko <${smtpUser}>`,
    replyTo: configuredFrom || undefined,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      pool: true,
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      maxConnections: 2,
      maxMessages: 100,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }

  return transporter;
}

export async function sendEmailVerification({ code, email, fullName }) {
  if (!isEmailConfigured()) {
    if (!config.allowMockEmailVerification) {
      throw new HttpError(
        503,
        "A verificação por e-mail não está configurada no servidor. Tente novamente mais tarde."
      );
    }

    console.log(`[mock-email] ${email} -> código ${code}`);
    return { provider: "mock-email" };
  }

  const startedAt = Date.now();

  await getTransporter().sendMail({
    ...getMailIdentity(),
    to: email,
    subject: "Código de validação Worko",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;color:#0f172a;margin:0 0 12px">Worko</h1>
        <p style="font-size:14px;color:#334155;line-height:1.6">
          Olá, ${fullName}. Use o código abaixo para validar seu cadastro.
        </p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb;background:#eff6ff;border-radius:16px;padding:18px 24px;text-align:center;margin:24px 0">
          ${code}
        </div>
        <p style="font-size:13px;color:#64748b;line-height:1.6">
          O código expira em 10 minutos.
        </p>
      </div>
    `,
  });

  console.log(`[email] verification sent to ${email} in ${Date.now() - startedAt}ms`);
  return { provider: "gmail-smtp" };
}

export async function sendPasswordResetEmail({ code, email, fullName }) {
  if (!isEmailConfigured()) {
    if (!config.allowMockEmailVerification) {
      throw new HttpError(
        503,
        "A recuperação de senha por e-mail não está configurada no servidor."
      );
    }

    console.log(`[mock-email] ${email} -> recuperação de senha ${code}`);
    return { provider: "mock-email" };
  }

  const safeName = escapeHtml(fullName || "usuário(a)");
  const safeCode = escapeHtml(code);

  await getTransporter().sendMail({
    ...getMailIdentity(),
    to: email,
    subject: "Código para redefinir sua senha | Worko",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;color:#0f172a;margin:0 0 12px">Worko</h1>
        <p style="font-size:14px;color:#334155;line-height:1.6">Olá, ${safeName}.</p>
        <p style="font-size:14px;color:#334155;line-height:1.6">
          Recebemos um pedido para redefinir sua senha. Digite este código no aplicativo:
        </p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb;background:#eff6ff;border-radius:16px;padding:18px 24px;text-align:center;margin:24px 0">${safeCode}</div>
        <p style="font-size:13px;color:#64748b;line-height:1.6">
          O código é de uso único e expira em 10 minutos. Se você não fez este pedido, ignore este e-mail.
        </p>
      </div>
    `,
  });

  return { provider: "gmail-smtp" };
}

export async function sendNewDeviceLoginEmail({
  code,
  email,
  fullName,
  deviceLabel,
  loginLocation,
  requestedAt,
}) {
  if (!isEmailConfigured()) {
    if (!config.allowMockEmailVerification) {
      throw new HttpError(
        503,
        "A confirmação de aparelho por e-mail não está configurada no servidor."
      );
    }

    console.log(`[mock-email] ${email} -> confirmação de novo aparelho ${code}`);
    return { provider: "mock-email" };
  }

  const safeName = escapeHtml(fullName || "usuário(a)");
  const safeCode = escapeHtml(code);
  const safeDevice = escapeHtml(deviceLabel || "Novo aparelho");
  const safeLocation = escapeHtml(loginLocation || "Localização indisponível");
  const safeRequestedAt = escapeHtml(requestedAt || "agora");
  const recoveryUrl = `${config.appBaseUrl}/forgot-password?email=${encodeURIComponent(email)}`;

  await getTransporter().sendMail({
    ...getMailIdentity(),
    to: email,
    subject: "Tentativa de acesso em outro aparelho | Worko",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;color:#0f172a;margin:0 0 12px">Worko</h1>
        <p style="font-size:14px;color:#334155;line-height:1.6">Olá, ${safeName}.</p>
        <h2 style="font-size:20px;color:#0f172a;margin:18px 0 10px">Alguém tentou entrar em sua conta</h2>
        <div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:14px;padding:14px;color:#1e3a8a;font-size:13px;line-height:1.6">
          <strong>Aparelho:</strong> ${safeDevice}<br />
          <strong>Local aproximado:</strong> ${safeLocation}<br />
          <strong>Data:</strong> ${safeRequestedAt}
        </div>
        <p style="font-size:14px;color:#334155;line-height:1.6;margin-top:18px">
          Se foi você, use o código abaixo para liberar este aparelho:
        </p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#2563eb;background:#eff6ff;border-radius:16px;padding:18px 24px;text-align:center;margin:24px 0">${safeCode}</div>
        <p style="font-size:13px;color:#64748b;line-height:1.6">
          O código é de uso único e expira em 10 minutos. Se não foi você, não compartilhe o código e redefina sua senha imediatamente.
        </p>
        <a href="${escapeHtml(recoveryUrl)}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:14px;padding:12px 18px">Não fui eu: redefinir senha</a>
      </div>
    `,
  });

  return { provider: "gmail-smtp" };
}

export async function sendServicePaymentReceiptEmail(receipt) {
  if (!receipt?.requester?.email) {
    return { provider: "skipped" };
  }

  if (!isEmailConfigured()) {
    if (!config.allowMockEmailVerification) {
      throw new HttpError(
        503,
        "O envio de e-mail não está configurado no servidor para mandar o comprovante."
      );
    }

    console.log(
      `[mock-email] ${receipt.requester.email} -> comprovante ${receipt.receiptNumber}`
    );
    return { provider: "mock-email" };
  }

  const pdfBuffer = await buildServicePaymentReceiptPdf(receipt);
  const totalFormatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(receipt.amounts?.totalCents) || 0) / 100);

  await getTransporter().sendMail({
    ...getMailIdentity(),
    to: receipt.requester.email,
    subject: "Comprovante de pagamento do serviço Worko",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;color:#0f172a;margin:0 0 12px">Worko</h1>
        <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 12px">
          Olá, ${receipt.requester.fullName}. O pagamento do seu serviço foi confirmado com sucesso.
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 18px">
          O comprovante em PDF segue em anexo. Total pago: <strong>${totalFormatted}</strong>.
        </p>
        <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#f8fafc">
          <p style="margin:0 0 8px;font-size:13px;color:#0f172a"><strong>Comprovante:</strong> ${receipt.receiptNumber}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#0f172a"><strong>Serviço:</strong> ${receipt.service.category}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#0f172a"><strong>Profissional:</strong> ${receipt.worker.fullName}</p>
          <p style="margin:0;font-size:13px;color:#0f172a"><strong>Pagamento Asaas:</strong> ${receipt.paymentId}</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `comprovante-worko-${receipt.receiptNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { provider: "gmail-smtp" };
}

export async function sendProviderVerificationDecisionEmail({
  email,
  fullName,
  decision,
  reason = "",
}) {
  const normalizedDecision = String(decision ?? "").trim().toLowerCase();
  const safeName = escapeHtml(fullName || "prestador(a)");
  const safeReason = escapeHtml(reason).trim();
  const isApproved = normalizedDecision === "approved";
  const isDocumentRequest = normalizedDecision === "changes_requested";

  if (!email) {
    return { provider: "skipped" };
  }

  if (!isEmailConfigured()) {
    if (!config.allowMockEmailVerification) {
      console.error("Provider verification email skipped because SMTP is not configured.", {
        email,
        decision: normalizedDecision,
      });
      return { provider: "unconfigured" };
    }

    console.log(`[mock-email] ${email} -> decisÃ£o da verificaÃ§Ã£o: ${normalizedDecision}`);
    return { provider: "mock-email" };
  }

  const subject = isApproved
    ? "Seu cadastro de prestador(a) foi aprovado | Worko"
    : isDocumentRequest
      ? "Precisamos de novos documentos para analisar seu cadastro | Worko"
      : "AtualizaÃ§Ã£o sobre seu cadastro de prestador(a) | Worko";
  const headline = isApproved
    ? "Seu acesso como prestador(a) foi liberado"
    : isDocumentRequest
      ? "Precisamos que vocÃª reenvie seus documentos"
      : "Seu cadastro de prestador(a) nÃ£o foi aprovado";
  const description = isApproved
    ? "Sua anÃ¡lise foi concluÃ­da. Entre no Worko para acessar o mapa, mensagens e carteira."
    : isDocumentRequest
      ? "Entre no Worko, envie novamente os documentos solicitados e sua anÃ¡lise serÃ¡ retomada."
      : "ApÃ³s a anÃ¡lise cadastral, nÃ£o foi possÃ­vel liberar o acesso como prestador(a).";

  await getTransporter().sendMail({
    ...getMailIdentity(),
    to: email,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h1 style="font-size:24px;color:#0f172a;margin:0 0 12px">Worko</h1>
        <p style="font-size:14px;color:#334155;line-height:1.6">OlÃ¡, ${safeName}.</p>
        <h2 style="font-size:20px;color:#0f172a;margin:18px 0 10px">${headline}</h2>
        <p style="font-size:14px;color:#334155;line-height:1.6">${description}</p>
        ${safeReason ? `<div style="margin-top:18px;border:1px solid #dbeafe;background:#eff6ff;border-radius:14px;padding:14px"><strong style="font-size:13px;color:#1e3a8a">Mensagem da equipe:</strong><p style="margin:8px 0 0;font-size:13px;color:#1e3a8a;line-height:1.5">${safeReason}</p></div>` : ""}
      </div>
    `,
  });

  return { provider: "gmail-smtp" };
}

