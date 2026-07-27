export function formatProfileDateTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatJoinedDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function parseTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/,|\n/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);
}

export function stringifyTagInput(items: string[]) {
  return items.join(", ");
}
