import { Check } from "lucide-react";
import { cn } from "./utils";

const badgeSizeClasses = {
  sm: {
    container: "h-4 w-4",
    icon: "h-2.5 w-2.5",
  },
  md: {
    container: "h-5 w-5",
    icon: "h-3 w-3",
  },
  lg: {
    container: "h-6 w-6",
    icon: "h-3.5 w-3.5",
  },
} as const;

type VerifiedBadgeProps = {
  className?: string;
  size?: keyof typeof badgeSizeClasses;
  title?: string;
};

export function VerifiedBadge({
  className,
  size = "sm",
  title = "Perfil verificado",
}: VerifiedBadgeProps) {
  const sizeClasses = badgeSizeClasses[size];

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_6px_18px_rgba(14,165,233,0.35)] ring-2 ring-white/90",
        sizeClasses.container,
        className
      )}
    >
      <Check className={sizeClasses.icon} strokeWidth={3.2} />
    </span>
  );
}
