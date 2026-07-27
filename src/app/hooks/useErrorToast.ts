import { useEffect, useRef } from "react";
import { dispatchSystemStatus } from "../api/client";

export function useErrorToast(error: string | null | undefined) {
  const lastShownRef = useRef("");

  useEffect(() => {
    const message = String(error ?? "").trim();

    if (!message || message === lastShownRef.current) {
      return;
    }

    lastShownRef.current = message;
    dispatchSystemStatus({
      kind: "error",
      message,
    });
  }, [error]);
}
