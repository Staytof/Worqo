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
};

export function ServiceTimeline({
  timeline,
  title = "Linha do atendimento",
}: ServiceTimelineProps) {
  if (timeline.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
        {title}
      </p>

      <div className="mt-4 space-y-3">
        {timeline.map((event, index) => {
          const Icon = getTimelineIcon(event.kind);
          const isLast = index === timeline.length - 1;

          return (
            <div key={event.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                  <Icon className="h-4 w-4" />
                </div>
                {!isLast ? <span className="mt-1 h-8 w-px bg-slate-200" /> : null}
              </div>

              <div className="min-w-0 flex-1 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {formatTimelineTime(event.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {event.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
