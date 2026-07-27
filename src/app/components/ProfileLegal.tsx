import { FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { getSupportWhatsappHref, supportInfo } from "../content/support";
import { useApp } from "../context/AppContext";
import { ProfileSectionLayout } from "./profile/ProfileSectionLayout";
import { formatProfileDateTime } from "./profile/profile-utils";

export function ProfileLegal() {
  const {
    state: { user },
  } = useApp();

  const acceptedAtLabel = formatProfileDateTime(
    user.termsAcceptedAt ?? user.privacyAcceptedAt
  );
  const supportWhatsappHref = getSupportWhatsappHref();

  return (
    <ProfileSectionLayout
      eyebrow="Termos do app"
      title="Regras, privacidade e aceite legal"
    >
      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            Status do aceite
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Documentos aceitos</h2>

          <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-700">
              {acceptedAtLabel
                ? `Aceite registrado em ${acceptedAtLabel}`
                : "Aceite registrado na sua conta"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Link
            to="/legal#termos"
            className="group flex items-center gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/50"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-blue-100 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900">Termos de uso</h3>
            </div>
          </Link>

          <Link
            to="/legal#privacidade"
            className="group flex items-center gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/50"
          >
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-blue-100 text-blue-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-900">Privacidade</h3>
            </div>
          </Link>

          {supportInfo.email || supportInfo.whatsapp ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
                Suporte oficial
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
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
    </ProfileSectionLayout>
  );
}
