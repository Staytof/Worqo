import { CheckCircle2, Clock3, ShieldAlert, Wallet } from "lucide-react";
import type { ServiceTimelineEvent } from "../../types";

function formatTimelineTime(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function repairMojibake(value: string) {
  let text = value;

  for (let attempt = 0; attempt < 2 && /[\u00c3\u00c2\ufffd]/.test(text); attempt += 1) {
    const bytes = Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8").decode(bytes);

    if (!decoded || decoded === text) {
      break;
    }

    text = decoded;
  }

  return text.replace(/\uFFFD/g, "");
}

function getTimelineIcon(kind: string) {
  if (kind.includes("payment") || kind.includes("withdrawal")) {
    return Wallet;
  }

  if (kind.includes("dispute")) {
    return ShieldAlert;
  }

  if (kind.includes("completed") || kind.includes("confirmed")) {
    return CheckCircle2;
  }

  return Clock3;
}

type ServiceTimelineProps = {
  timeline: ServiceTimelineEvent[];
  title?: string;
  showDescriptions?: boolean;
};

export function ServiceTimeline({
  timeline,
  title = "Linha do atendimento",
  showDescriptions = false,
}: ServiceTimelineProps) {
  if (timeline.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
        {title}
      </p>

      <div className="mt-2 divide-y divide-slate-100">
        {timeline.map((event, index) => {
          const Icon = getTimelineIcon(event.kind);
          const isLast = index === timeline.length - 1;
          const titleText = repairMojibake(event.title);
          const descriptionText = repairMojibake(event.description);

          return (
            <div key={event.id} className="flex items-start gap-2.5 py-2 first:pt-1 last:pb-0">
              <div className="flex flex-col items-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {!isLast ? <span className="mt-1 h-2 w-px bg-slate-200" /> : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-bold text-slate-900">{titleText}</p>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {formatTimelineTime(event.createdAt)}
                  </span>
                </div>
                {showDescriptions && descriptionText ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
                    {descriptionText}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
