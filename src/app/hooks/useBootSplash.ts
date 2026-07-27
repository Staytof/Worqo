import { useEffect, useState } from "react";

const BOOT_SPLASH_DURATION_MS = 2000;
let splashCompletedForCurrentLoad = false;

export function useBootSplash() {
  const [isVisible, setIsVisible] = useState(() => !splashCompletedForCurrentLoad);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      splashCompletedForCurrentLoad = true;
      setIsVisible(false);
    }, BOOT_SPLASH_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isVisible]);

  return isVisible;
}
