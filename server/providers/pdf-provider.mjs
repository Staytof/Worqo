import PDFDocument from "pdfkit";
import { config } from "../config.mjs";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrencyFromCents(value) {
  return currencyFormatter.format((Number(value) || 0) / 100);
}

function formatDateTime(value) {
  const date = new Date(value ?? "");

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function writePair(doc, label, value) {
  const normalizedValue = String(value ?? "").trim() || "-";
  doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(normalizedValue);
}

function drawSectionTitle(doc, title) {
  doc.moveDown(0.7);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#0f172a").text(title);
  doc.moveDown(0.3);
}

export async function buildServicePaymentReceiptPdf(receipt) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 42,
    info: {
      Title: `Comprovante de pagamento ${receipt.receiptNumber}`,
      Author: "Worko",
      Subject: "Comprovante de pagamento de serviço",
      Creator: "Worko",
      Producer: "Worko",
    },
  });

  const chunks = [];

  doc.on("data", (chunk) => {
    chunks.push(chunk);
  });

  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(22).fillColor("#0f172a").text("Worko");
  doc
    .moveDown(0.25)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Comprovante de pagamento de serviço");
  doc
    .moveDown(0.35)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#475569")
    .text(
      "Este documento registra o pagamento intermediado pelo Worko e não substitui nota fiscal emitida pelo(a) profissional."
    );

  drawSectionTitle(doc, "Identificação");
  doc.fontSize(10).fillColor("#0f172a");
  writePair(doc, "Comprovante", receipt.receiptNumber);
  writePair(doc, "Pagamento Asaas", receipt.paymentId);
  writePair(doc, "Confirmado em", formatDateTime(receipt.confirmedAt));
  writePair(doc, "Emissor do comprovante", "Raaberts Softwares / Worko");

  drawSectionTitle(doc, "Pagador");
  writePair(doc, "Nome", receipt.requester.fullName);
  writePair(doc, "E-mail", receipt.requester.email);
  writePair(doc, "CPF", receipt.requester.cpf);

  drawSectionTitle(doc, "Profissional");
  writePair(doc, "Nome", receipt.worker.fullName);
  writePair(doc, "CPF", receipt.worker.cpf);

  drawSectionTitle(doc, "Serviço");
  writePair(doc, "Categoria", receipt.service.category);
  writePair(doc, "Descrição", receipt.service.description);
  writePair(doc, "Data combinada", receipt.service.serviceDate || "-");
  writePair(doc, "Horário", receipt.service.schedule || "-");
  writePair(doc, "Endereço", receipt.service.address || "-");

  drawSectionTitle(doc, "Valores");
  writePair(doc, "Valor do serviço", formatCurrencyFromCents(receipt.amounts.subtotalCents));
  writePair(doc, "Taxa do app (10%)", formatCurrencyFromCents(receipt.amounts.appFeeCents));
  writePair(
    doc,
    "Taxa de intermediação Worko",
    formatCurrencyFromCents(receipt.amounts.asaasFeeCents)
  );
  writePair(doc, "Total pago", formatCurrencyFromCents(receipt.amounts.totalCents));
  writePair(doc, "Valor líquido do(a) profissional", formatCurrencyFromCents(receipt.amounts.subtotalCents));

  drawSectionTitle(doc, "Referências");
  writePair(doc, "Cobrança", receipt.invoiceUrl || "-");
  writePair(doc, "Base do aplicativo", config.appBaseUrl || "-");
  writePair(doc, "Emitido em", formatDateTime(new Date().toISOString()));

  doc.moveDown(1.2);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#64748b")
    .text(
      "Guarde este comprovante. O PDF também é válido como recibo eletrônico do pagamento intermediado pela plataforma."
    );

  doc.end();

  return done;
}

