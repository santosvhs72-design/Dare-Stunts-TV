package com.darestunts.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.util.SparseArray;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * Android TV shell for Dare Stunts.
 *
 * The game -- physics, WebGL rendering, HUD, sound -- is the same engine as the
 * desktop original; only the interface around it is built for a television.
 * The files are served from
 * https://appassets.androidplatform.net/ instead of file:// because that is a
 * secure context, which the game's ES modules and the Gamepad API both require.
 * Nothing is fetched from the network: every asset is inside the APK.
 */
public class MainActivity extends Activity {
    private static final String HOME =
            "https://appassets.androidplatform.net/assets/game/index.html";

    private WebView webView;
    private boolean pageReady = false;

    /**
     * Remote keys the page handles itself, consumed here and handed straight to
     * it. Two reasons. WebView reports D-pad presses with an empty
     * KeyboardEvent.code -- the property describes a physical keyboard key, and
     * a remote is not one -- so web handlers written against `code` never fire.
     * And left alone, WebView also runs its own spatial navigation over the same
     * presses, which walks focus out of the document and leaves the app dead to
     * input after the first press. Forwarding gives the page the only say.
     *
     * A controller's face buttons are here too. They used to be left out, on the
     * grounds that a controller reaches the page through the Gamepad API and
     * forwarding them as well would act on every press twice -- but that leans
     * the whole controller on an API that WebView does not always expose, and
     * when it is missing the D-pad still works (Android sends it as DPAD_*,
     * forwarded above) while A does nothing at all, so nothing can be confirmed
     * and the controller looks dead. Forwarding costs nothing: the page already
     * collapses an action arriving twice inside 90 ms, which it has to do
     * anyway, because a pad's D-pad has always arrived as a key event *and* as
     * a polled button.
     */
    private static final SparseArray<String> TV_KEYS = new SparseArray<>();
    static {
        TV_KEYS.put(KeyEvent.KEYCODE_DPAD_UP, "ArrowUp");
        TV_KEYS.put(KeyEvent.KEYCODE_DPAD_DOWN, "ArrowDown");
        TV_KEYS.put(KeyEvent.KEYCODE_DPAD_LEFT, "ArrowLeft");
        TV_KEYS.put(KeyEvent.KEYCODE_DPAD_RIGHT, "ArrowRight");
        TV_KEYS.put(KeyEvent.KEYCODE_DPAD_CENTER, "Enter");
        TV_KEYS.put(KeyEvent.KEYCODE_ENTER, "Enter");
        TV_KEYS.put(KeyEvent.KEYCODE_NUMPAD_ENTER, "Enter");
        TV_KEYS.put(KeyEvent.KEYCODE_SPACE, "Enter");
        TV_KEYS.put(KeyEvent.KEYCODE_MENU, "KeyM");
        TV_KEYS.put(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, "KeyM");
        // Controller face and shoulder buttons, named as the page names them.
        TV_KEYS.put(KeyEvent.KEYCODE_BUTTON_A, "Enter");
        TV_KEYS.put(KeyEvent.KEYCODE_BUTTON_B, "Escape");
        TV_KEYS.put(KeyEvent.KEYCODE_BUTTON_X, "KeyX");
        TV_KEYS.put(KeyEvent.KEYCODE_BUTTON_Y, "KeyY");
        TV_KEYS.put(KeyEvent.KEYCODE_BUTTON_L1, "KeyQ");
        TV_KEYS.put(KeyEvent.KEYCODE_BUTTON_R1, "KeyE");
        TV_KEYS.put(KeyEvent.KEYCODE_BUTTON_START, "KeyM");
        TV_KEYS.put(KeyEvent.KEYCODE_BUTTON_SELECT, "Escape");
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // A lap runs for minutes with no touch input at all; the television must
        // not dim or drop into a screensaver part-way round.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);   // localStorage: records, saved tracks, chosen car
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // There is no tap on a television, and remote presses reach the page as
        // synthetic events, which do not count as user activation. Requiring a
        // gesture would therefore mean the engine note never starts at all.
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                view.requestFocus();
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        // With no touchscreen, nothing claims input focus by itself; being
        // explicit is what makes the remote work at all.
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(false);

        setContentView(webView);
        webView.requestFocus();
        webView.loadUrl(HOME);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // requestFocus() during onCreate() can be a no-op while the view
        // hierarchy is still attaching. The window gaining focus is the reliable
        // moment, and the only one that fires again after a system dialog or the
        // launcher has taken focus away and given it back.
        if (hasFocus) webView.requestFocus();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        String name = TV_KEYS.get(event.getKeyCode());
        int action = event.getAction();
        // Before the page exists there is nothing to forward to, so leave normal
        // handling in place rather than swallowing the press.
        if (name == null || !pageReady
                || (action != KeyEvent.ACTION_DOWN && action != KeyEvent.ACTION_UP)) {
            return super.dispatchKeyEvent(event);
        }
        // Names come from the fixed table above and never from outside, so
        // splicing one into the script is safe.
        webView.evaluateJavascript("window.__tvKey && window.__tvKey('"
                + (action == KeyEvent.ACTION_DOWN ? "down" : "up")
                + "','" + name + "')", null);
        return true;
    }

    @Override
    public void onBackPressed() {
        // Back closes whatever the page has open -- a panel, a modal, a paused
        // race -- and only exits the app once the page reports there was nothing
        // left to close.
        webView.evaluateJavascript(
                "(window.__tvBack ? window.__tvBack() : true)",
                result -> {
                    if ("true".equals(result)) {
                        MainActivity.super.onBackPressed();
                    }
                });
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
