import { FileText, ShieldCheck } from "lucide-react";
import {
  LEGAL_LAST_UPDATED,
  LEGAL_VERSION,
  privacySections,
  termsOfUseSections,
  type LegalSection,
} from "../../content/legal";

type LegalDocumentProps = {
  compact?: boolean;
};

function SectionBlock({
  section,
  compact,
}: {
  section: LegalSection;
  compact: boolean;
}) {
  return (
    <section id={section.id} className={compact ? "space-y-2" : "space-y-3"}>
      <h3
        className={`font-semibold text-slate-900 ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        {section.title}
      </h3>
      {section.paragraphs.map((paragraph) => (
        <p
          key={paragraph}
          className={`leading-relaxed text-slate-600 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {paragraph}
        </p>
      ))}
      {section.bullets ? (
        <ul
          className={`space-y-2 text-slate-600 ${
            compact ? "pl-4 text-xs" : "pl-5 text-sm"
          }`}
        >
          {section.bullets.map((bullet) => (
            <li key={bullet} className="list-disc leading-relaxed">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function LegalDocument({ compact = false }: LegalDocumentProps) {
  return (
    <div className={compact ? "space-y-6" : "space-y-10"}>
      <section className={compact ? "space-y-3" : "space-y-4"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <FileText className="h-3.5 w-3.5" />
            Termos de Uso
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Aviso de Privacidade
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            Versão {LEGAL_VERSION}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            Atualizado em {LEGAL_LAST_UPDATED}
          </span>
        </div>

      </section>

      <section id="termos" className={compact ? "space-y-4" : "space-y-5"}>
        <div className="space-y-1">
          <h2 className={compact ? "text-base font-bold text-slate-900" : "text-xl font-bold text-slate-900"}>
            Termos de Uso
          </h2>
        </div>

        <div className={compact ? "space-y-4" : "space-y-6"}>
          {termsOfUseSections.map((section) => (
            <SectionBlock key={section.id} section={section} compact={compact} />
          ))}
        </div>
      </section>

      <section id="privacidade" className={compact ? "space-y-4" : "space-y-5"}>
        <div className="space-y-1">
          <h2 className={compact ? "text-base font-bold text-slate-900" : "text-xl font-bold text-slate-900"}>
            Aviso de Privacidade
          </h2>
        </div>

        <div className={compact ? "space-y-4" : "space-y-6"}>
          {privacySections.map((section) => (
            <SectionBlock key={section.id} section={section} compact={compact} />
          ))}
        </div>
      </section>
    </div>
  );
}
