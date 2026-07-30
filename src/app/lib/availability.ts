export const availabilityDayOptions = [
  { id: "mon", short: "S", label: "Segunda", saved: "Seg" },
  { id: "tue", short: "T", label: "Terça", saved: "Ter" },
  { id: "wed", short: "Q", label: "Quarta", saved: "Qua" },
  { id: "thu", short: "Q", label: "Quinta", saved: "Qui" },
  { id: "fri", short: "S", label: "Sexta", saved: "Sex" },
  { id: "sat", short: "S", label: "Sábado", saved: "Sáb" },
  { id: "sun", short: "D", label: "Domingo", saved: "Dom" },
] as const;

export type AvailabilityDayId = (typeof availabilityDayOptions)[number]["id"];

export type AvailabilitySchedule = {
  days: AvailabilityDayId[];
  startTime: string;
  endTime: string;
};

function normalizeSearchText(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function includesDayToken(value: string, tokens: string[]) {
  return tokens.some((token) => {
    const pattern = new RegExp(`(?:^|[\\s,;/])${token}(?:-feira)?(?=$|[\\s,;/])`, "i");
    return pattern.test(value);
  });
}

export function parseAvailabilitySchedule(value: string): AvailabilitySchedule {
  const normalized = normalizeSearchText(value);
  const times = String(value ?? "").match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g) ?? [];
  const describesWeekdays =
    /(?:segunda|seg)\s+(?:a|ate)\s+(?:sexta|sex)/.test(normalized);
  const days = describesWeekdays
    ? availabilityDayOptions.slice(0, 5).map((day) => day.id)
    : availabilityDayOptions
        .filter((day) => {
          const fullLabel = normalizeSearchText(day.label);
          const savedLabel = normalizeSearchText(day.saved);
          return includesDayToken(normalized, [fullLabel, savedLabel]);
        })
        .map((day) => day.id);

  return {
    days,
    startTime: times[0]?.padStart(5, "0") ?? "",
    endTime: times[1]?.padStart(5, "0") ?? "",
  };
}

export function buildAvailabilityNote(
  days: AvailabilityDayId[],
  startTime: string,
  endTime: string
) {
  const selectedLabels = availabilityDayOptions
    .filter((day) => days.includes(day.id))
    .map((day) => day.saved);
  const dayLabel = selectedLabels.join(", ");
  const timeLabel = startTime && endTime ? `das ${startTime} às ${endTime}` : "";

  return [dayLabel, timeLabel].filter(Boolean).join(", ");
}

export function validateAvailabilitySchedule({
  days,
  startTime,
  endTime,
}: AvailabilitySchedule) {
  const hasAnyValue = days.length > 0 || Boolean(startTime) || Boolean(endTime);

  if (!hasAnyValue) {
    return null;
  }

  if (days.length === 0) {
    return "Escolha pelo menos um dia de atendimento.";
  }

  if (!startTime || !endTime) {
    return "Informe o horário de início e de término.";
  }

  if (endTime <= startTime) {
    return "O horário de término precisa ser depois do horário de início.";
  }

  return null;
}

