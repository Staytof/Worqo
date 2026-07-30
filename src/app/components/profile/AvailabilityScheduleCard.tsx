import { Clock3 } from "lucide-react";
import {
  availabilityDayOptions,
  parseAvailabilitySchedule,
} from "../../lib/availability";

type AvailabilityScheduleCardProps = {
  value: string;
  compact?: boolean;
};

export function AvailabilityScheduleCard({
  value,
  compact = false,
}: AvailabilityScheduleCardProps) {
  const schedule = parseAvailabilitySchedule(value);
  const hasStructuredSchedule =
    schedule.days.length > 0 || Boolean(schedule.startTime && schedule.endTime);

  if (!hasStructuredSchedule) {
    return (
      <div className="rounded-2xl bg-slate-50 px-4 py-3">
        <p className="break-words text-sm font-semibold leading-relaxed text-slate-700">
          {value}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-[22px] bg-slate-50 ${compact ? "p-3" : "p-4"}`}>
      <div className="grid grid-cols-7 gap-1.5">
        {availabilityDayOptions.map((day) => {
          const isAvailable = schedule.days.includes(day.id);

          return (
            <div key={day.id} className="min-w-0 text-center">
              <span
                title={day.label}
                aria-label={`${day.label}: ${isAvailable ? "disponível" : "indisponível"}`}
                className={`mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full font-black ${
                  compact ? "text-[11px]" : "text-xs"
                } ${
                  isAvailable
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "bg-white text-slate-300 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {day.short}
              </span>
            </div>
          );
        })}
      </div>

      {schedule.startTime && schedule.endTime ? (
        <div
          className={`mt-3 flex items-center justify-center gap-2 rounded-2xl bg-white font-bold text-slate-700 ${
            compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
          }`}
        >
          <Clock3 className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            {schedule.startTime} <span className="font-medium text-slate-400">até</span>{" "}
            {schedule.endTime}
          </span>
        </div>
      ) : null}
    </div>
  );
}
