import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  ACCEPTED_SERVICE_CATALOG_ORDER,
  ACCEPTED_SERVICES_NOTICE,
  RESTRICTED_SERVICES_NOTICE,
  acceptedServiceCatalog,
} from "../content/serviceCatalog";
import { getSupportWhatsappHref, supportInfo } from "../content/support";
import { useApp } from "../context/AppContext";
import { LegalDocument } from "./legal/LegalDocument";
import { FloatingBackButton } from "./ui/FloatingBackButton";

export function LegalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    state: { isAuthenticated },
  } = useApp();
  const supportWhatsappHref = getSupportWhatsappHref();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      return;
    }

    const element = document.getElementById(location.hash.replace("#", ""));

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(isAuthenticated ? "/app/profile" : "/verify");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div
        className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8"
        style={{
          paddingTop: "calc(24px + env(safe-area-inset-top, 0px))",
          paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
        }}
      >
        <FloatingBackButton
          ariaLabel="Voltar"
          onClick={handleBack}
          className="fixed left-4 top-[calc(16px+env(safe-area-inset-top,0px))] z-40 h-12 w-12 bg-white/95 text-slate-700 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
        />

        <div className="mb-5 flex flex-col items-start gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              Documento legal
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              Termos de Uso e Privacidade
            </h1>
          </div>
        </div>

        <div className="mb-5 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            Catálogo atual do Worko
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {ACCEPTED_SERVICES_NOTICE}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {ACCEPTED_SERVICE_CATALOG_ORDER.map((category) => {
              const entry = acceptedServiceCatalog[category];

              return (
                <div
                  key={category}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{entry.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.examples.slice(0, 6).map((example) => (
                      <span
                        key={example}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold text-amber-950">Não aceitos na plataforma</p>
            <p className="mt-1 leading-relaxed">{RESTRICTED_SERVICES_NOTICE}</p>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <LegalDocument />
        </div>

        {supportInfo.email || supportInfo.whatsapp ? (
          <div className="mt-5 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              Suporte oficial
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Em casó de dúvidas sobre conta, pagamentos, privacidade ou segurança, use o canal
              oficial abaixo.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              {supportInfo.email ? (
                <a
                  href={`mailto:${supportInfo.email}`}
                  className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {supportInfo.email}
                </a>
              ) : null}

              {supportWhatsappHref ? (
                <a
                  href={supportWhatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {supportInfo.whatsapp}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


