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

