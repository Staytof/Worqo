package com.worqo.app;

import static androidx.browser.customtabs.CustomTabsIntent.SHARE_STATE_OFF;

import android.content.Intent;
import android.net.Uri;

import androidx.browser.customtabs.CustomTabsIntent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SecureOAuthBrowser")
public class SecureOAuthBrowserPlugin extends Plugin {
    private boolean waitingForBrowserReturn = false;
    private boolean browserPausedApp = false;

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "").trim();
        Uri uri;

        try {
            uri = Uri.parse(url);
        } catch (Exception error) {
            call.reject("URL de autenticação inválida.");
            return;
        }

        String scheme = uri.getScheme();
        if (scheme == null || (!scheme.equals("https") && !scheme.equals("http"))) {
            call.reject("A autenticação exige uma URL HTTP segura.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                waitingForBrowserReturn = true;
                browserPausedApp = false;
                CustomTabsIntent tabsIntent = new CustomTabsIntent.Builder()
                    .setShareState(SHARE_STATE_OFF)
                    .build();
                tabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
                tabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
                tabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                tabsIntent.intent.putExtra(
                    Intent.EXTRA_REFERRER,
                    Uri.parse(Intent.URI_ANDROID_APP_SCHEME + "//" + getContext().getPackageName())
                );
                tabsIntent.launchUrl(getContext(), uri);
                call.resolve(new JSObject());
            } catch (Exception error) {
                waitingForBrowserReturn = false;
                browserPausedApp = false;
                call.reject("Não conseguimos abrir o login seguro do Google.", error);
            }
        });
    }

    @Override
    protected void handleOnPause() {
        if (waitingForBrowserReturn) {
            browserPausedApp = true;
        }
    }

    @Override
    protected void handleOnResume() {
        if (!waitingForBrowserReturn || !browserPausedApp) {
            return;
        }

        waitingForBrowserReturn = false;
        browserPausedApp = false;
        notifyListeners("browserReturned", new JSObject());
    }
}
