export const supportInfo = {
  email: (import.meta.env.VITE_SUPPORT_EMAIL ?? "").trim(),
  whatsapp: (import.meta.env.VITE_SUPPORT_WHATSAPP ?? "").trim(),
  clientRelease: (import.meta.env.VITE_CLIENT_RELEASE ?? "").trim(),
};

export function getSupportWhatsappHref() {
  const digits = supportInfo.whatsapp.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}
