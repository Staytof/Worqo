export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 7) {
    return digits.replace(/(\d{2})(\d+)/, "($1) $2");
  }

  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  }

  return digits.replace(/(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
}

export function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isAdult(birthDate: string) {
  if (!birthDate) {
    return false;
  }

  const today = new Date();
  const birthday = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(birthday.getTime())) {
    return false;
  }

  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age -= 1;
  }

  return age >= 18;
}

export function isValidCpf(value: string) {
  const cpf = value.replace(/\D/g, "");

  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  let sum = 0;

  for (let index = 0; index < 9; index += 1) {
    sum += Number(cpf[index]) * (10 - index);
  }

  let remainder = (sum * 10) % 11;

  if (remainder === 10) {
    remainder = 0;
  }

  if (remainder !== Number(cpf[9])) {
    return false;
  }

  sum = 0;

  for (let index = 0; index < 10; index += 1) {
    sum += Number(cpf[index]) * (11 - index);
  }

  remainder = (sum * 10) % 11;

  if (remainder === 10) {
    remainder = 0;
  }

  return remainder === Number(cpf[10]);
}

export function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function getFirstNames(name: string, count = 2) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, count)
    .join(" ");
}

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");

  if (!domain) {
    return email;
  }

  const visible = localPart.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 4) {
    return phone;
  }

  return `${digits.slice(0, 2)} *****-${digits.slice(-4)}`;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Não conseguimos ler o arquivo."));
    };

    reader.onerror = () => {
      reject(new Error("Não conseguimos ler o arquivo."));
    };

    reader.readAsDataURL(file);
  });
}

export function readImageAsOptimizedDataUrl(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
  } = {}
) {
  const { maxDimension = 720, quality = 0.82 } = options;

  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Selecione uma imagem válida."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Não conseguimos ler a imagem."));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Não conseguimos ler a imagem."));
        return;
      }

      const image = new Image();

      image.onerror = () => {
        reject(new Error("Não conseguimos processar a imagem."));
      };

      image.onload = () => {
        const largestSide = Math.max(image.naturalWidth, image.naturalHeight, 1);
        const scale = Math.min(1, maxDimension / largestSide);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Não conseguimos processar a imagem."));
          return;
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

export function getLastItem<T>(items: T[]) {
  return items[items.length - 1] ?? null;
}

export function formatCurrencyInput(value: string) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 12);

  if (!digits) {
    return "";
  }

  const padded = digits.padStart(3, "0");
  const integerPart = padded.slice(0, -2);
  const decimalPart = padded.slice(-2);

  return `R$ ${Number(integerPart).toLocaleString("pt-BR")},${decimalPart}`;
}

export function parseCurrencyValue(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return 0;
  }

  return Number(digits) / 100;
}

export function formatCurrencyAmount(value: number) {
  const normalizedValue = Number.isFinite(value) ? Math.max(0, value) : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(normalizedValue);
}

export const SERVICE_APP_FEE_RATE = 0.1;
export const ASAAS_FIXED_FEE_AMOUNT = 1.99;
export const INSTANT_WITHDRAWAL_FEE_AMOUNT = 1.99;

export function calculateAppServiceFeeAmount(baseAmount: number, rate = SERVICE_APP_FEE_RATE) {
  const normalizedBaseAmount = Number.isFinite(baseAmount) ? Math.max(0, baseAmount) : 0;

  return Number((normalizedBaseAmount * rate).toFixed(2));
}

export function calculateAsaasFixedFeeAmount(baseAmount: number) {
  const normalizedBaseAmount = Number.isFinite(baseAmount) ? Math.max(0, baseAmount) : 0;
  return normalizedBaseAmount > 0 ? ASAAS_FIXED_FEE_AMOUNT : 0;
}

export function calculateServiceFeeAmount(baseAmount: number) {
  return Number(
    (
      calculateAppServiceFeeAmount(baseAmount) + calculateAsaasFixedFeeAmount(baseAmount)
    ).toFixed(2)
  );
}

export function formatScheduleInput(value: string) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function formatServiceDate(
  value: string,
  dateStyle: Intl.DateTimeFormatOptions["dateStyle"] = "medium"
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());

  if (!match) {
    return "";
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle }).format(date);
}

export function formatDelayTolerance(value: number) {
  const minutes = Math.max(0, Math.round(Number(value) || 0));

  if (minutes === 0) {
    return "Sem tolerância";
  }

  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

