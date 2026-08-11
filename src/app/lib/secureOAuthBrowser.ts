import { Capacitor, registerPlugin } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

type SecureOAuthBrowserPlugin = {
  open(options: { url: string }): Promise<void>;
  addListener(
    eventName: "browserReturned",
    listener: () => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

const SecureOAuthBrowser = registerPlugin<SecureOAuthBrowserPlugin>("SecureOAuthBrowser");

export async function openSecureOAuthBrowser(url: string) {
  if (Capacitor.getPlatform() === "android") {
    await SecureOAuthBrowser.open({ url });
    return;
  }

  await Browser.open({ url });
}

export function onSecureOAuthBrowserReturned(listener: () => void) {
  return SecureOAuthBrowser.addListener("browserReturned", listener);
}
