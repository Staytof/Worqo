import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "./utils";

type FloatingBackButtonProps = {
  to?: string;
  ariaLabel?: string;
  onClick?: () => void;
  className?: string;
  fallbackTo?: string;
};

export function FloatingBackButton({
  to,
  ariaLabel = "Voltar",
  onClick,
  className,
  fallbackTo = "/app",
}: FloatingBackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        if (onClick) {
          onClick();
          return;
        }

        if (to) {
          navigate(to);
          return;
        }

        if (typeof window !== "undefined" && window.history.length <= 1) {
          navigate(fallbackTo);
          return;
        }

        navigate(-1);
      }}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:bg-slate-50 hover:text-slate-900",
        className
      )}
      aria-label={ariaLabel}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
