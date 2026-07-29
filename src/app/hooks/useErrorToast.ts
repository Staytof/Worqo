import { useEffect, useRef } from "react";
import { dispatchSystemStatus, sanitizeUserFacingErrorMessage } from "../api/client";

export function useErrorToast(error: string | null | undefined) {
  const lastShownRef = useRef("");

  useEffect(() => {
    const message = String(error ?? "").trim();

    if (!message) {
      return;
    }

    const safeMessage = sanitizeUserFacingErrorMessage(message);

    if (safeMessage === lastShownRef.current) {
      return;
    }

    lastShownRef.current = safeMessage;
    dispatchSystemStatus({
      kind: "error",
      message: safeMessage,
    });
  }, [error]);
}
