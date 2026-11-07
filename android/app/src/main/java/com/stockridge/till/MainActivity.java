package com.stockridge.till;

import android.app.Activity;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * A WebView around the same Worker the browser uses. Chrome on the phone is
 * left alone, so the PWA still offers Download and Install. This app removes
 * those buttons from the page it loads.
 *
 * This is not the Windows till. It does not open stockridge.db, stockridge.key,
 * or Turso. Sales still go through the Worker. The last shop screen is kept
 * on this phone so the till can open when the line is down. It does not cache /api/.
 * The current build contract is android/README.md; keeper papers are not runtime files.
 */
public class MainActivity extends Activity {
    // Same signature the Windows till sends. A Dalvik client is not a browser,
    // and a rejected fill must not be stored as the offline page.
    private static final String CHROME_UA = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    private static final Pattern INSTALL_BUTTON = Pattern.compile(
            "<button\\b[^>]*\\bid=[\\\"'](?:install-btn|nav-install|login-install)[\\\"'][^>]*>.*?</button>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private WebView webView;
    private String hideScript = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideScript = readAsset("hide-install.js");
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new StockRidgeClient());
        webView.loadUrl(getString(R.string.stockridge_origin));
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } catch (Exception err) {
            return "";
        }
    }

    private File shellDir() {
        File dir = new File(getCacheDir(), "sr-shell");
        if (!dir.isDirectory() && !dir.mkdirs()) return getCacheDir();
        return dir;
    }

    private File shellHtml() {
        return new File(shellDir(), "shell.html");
    }

    private File assetFile(Uri uri) {
        String path = uri.getPath() == null ? "" : uri.getPath();
        String query = uri.getQuery() == null ? "" : uri.getQuery();
        String name = (path + "_" + query).replaceAll("[^A-Za-z0-9._-]", "_");
        if (name.length() > 80) name = name.substring(0, 48) + "_" + Integer.toHexString(name.hashCode());
        return new File(shellDir(), name);
    }

    private boolean shellAsset(String path) {
        return path.startsWith("/js/") || path.startsWith("/css/")
                || path.startsWith("/icons/") || path.startsWith("/brand/")
                || "/sw.js".equals(path);
    }

    private void writeFile(File file, byte[] body) {
        if (body == null || body.length == 0) return;
        File parent = file.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) return;
        File tmp = new File(parent == null ? getCacheDir() : parent, file.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(body);
            out.flush();
        } catch (Exception ignored) {
            tmp.delete();
            return;
        }
        if (!tmp.renameTo(file)) {
            file.delete();
            if (!tmp.renameTo(file)) tmp.delete();
        }
    }

    private boolean radioUp() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            Network net = cm.getActiveNetwork();
            if (net == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(net);
            return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Exception err) {
            return true;
        }
    }

    private byte[] readFile(File file) {
        if (file == null || !file.isFile() || file.length() <= 0 || file.length() > 8_000_000) return null;
        try (InputStream in = new FileInputStream(file);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) out.write(buf, 0, n);
            return out.toByteArray();
        } catch (Exception err) {
            return null;
        }
    }

    private WebResourceResponse bytesResponse(String mime, String encoding, byte[] body) {
        return new WebResourceResponse(mime, encoding, new ByteArrayInputStream(body));
    }

    private String encodingFor(String path) {
        if (path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg")
                || path.endsWith(".webp") || path.endsWith(".gif") || path.endsWith(".ico")) return null;
        return "utf-8";
    }

    private String mimeFor(String path, String header) {
        if (header != null && header.contains("/")) return header.split(";")[0].trim();
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".html")) return "text/html";
        return "application/octet-stream";
    }

    private final class StockRidgeClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (request == null || request.getUrl() == null) return null;
            if (request.getMethod() != null && !"GET".equalsIgnoreCase(request.getMethod())) return null;
            Uri uri = request.getUrl();
            if (!"https".equalsIgnoreCase(uri.getScheme())) return null;
            String host = uri.getHost() == null ? "" : uri.getHost();
            if (!host.endsWith("stockridge.workers.dev")) return null;
            String path = uri.getPath() == null ? "/" : uri.getPath();
            // Shop answers are never stored on the phone. A cached sale total is a lie.
            if (path.startsWith("/api/")) return null;
            boolean main = request.isForMainFrame();
            if (!main && !shellAsset(path)) return null;
            // No radio: do not wait on a socket. The last page is the till.
            if (!radioUp()) return cached(uri, path, main);

            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(uri.toString()).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(20000);
                conn.setRequestProperty("User-Agent", CHROME_UA);
                conn.setRequestProperty("Accept", main ? "text/html,application/xhtml+xml" : "*/*");
                int status = conn.getResponseCode();
                String type = conn.getContentType() == null ? "" : conn.getContentType();
                // A server answer is not a network miss. Let the WebView load it.
                if (status >= 400) return null;
                ByteArrayOutputStream body = new ByteArrayOutputStream();
                try (InputStream in = conn.getInputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) >= 0) body.write(buf, 0, n);
                }
                if (main) {
                    if (!type.toLowerCase().contains("html")) return null;
                    String html = body.toString("UTF-8");
                    html = INSTALL_BUTTON.matcher(html).replaceAll("");
                    String tag = "<script>" + hideScript + "</script>";
                    if (html.contains("<head>")) html = html.replace("<head>", "<head>" + tag);
                    else html = tag + html;
                    byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
                    // A challenge page is not the till. Do not store it as the shell.
                    if (html.contains("id=\"boot\"") || html.contains("id='boot'")) writeFile(shellHtml(), bytes);
                    return bytesResponse("text/html", "utf-8", bytes);
                }
                byte[] bytes = body.toByteArray();
                writeFile(assetFile(uri), bytes);
                return bytesResponse(mimeFor(path, type), encodingFor(path), bytes);
            } catch (Exception err) {
                return cached(uri, path, main);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }

        private WebResourceResponse cached(Uri uri, String path, boolean main) {
            if (main) {
                byte[] html = readFile(shellHtml());
                if (html == null) return null;
                return bytesResponse("text/html", "utf-8", html);
            }
            byte[] body = readFile(assetFile(uri));
            if (body == null) return null;
            return bytesResponse(mimeFor(path, null), encodingFor(path), body);
        }
    }
}
(function () {
  var css = '#install-btn,#nav-install,#login-install,.chip-install,.nav-install{display:none!important}';
  css += 'body.sr-one-business #business-switch,body.sr-one-business #business-chip,body.sr-one-business #business-switch-hint{display:none!important}';

  function hideInstall() {
    var style = document.getElementById('sr-native-install');
    if (!style && document.documentElement) {
      style = document.createElement('style');
      style.id = 'sr-native-install';
      style.textContent = css;
      document.documentElement.appendChild(style);
    }
    var ids = ['install-btn', 'nav-install', 'login-install'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }

  function oneBusiness() {
    var SR = window.SR;
    if (!SR || !SR.state || !SR.state.user) return false;
    if (SR.state.canSwitchBusiness && !SR.state.canSwitchBusiness()) return true;
    var user = SR.state.user;
    var role = String(user.role || '').toUpperCase();
    if (role === 'ADMIN' || role === 'OWNER') return false;
    var scope = SR.state.scope || {};
    if (scope.allBusinesses) return false;
    if (user.branch && user.branch.id) return true;
    var ids = scope.businessIds || [];
    return ids.length <= 1;
  }

  function hideSwitch() {
    var locked = oneBusiness();
    if (document.body) document.body.classList.toggle('sr-one-business', locked);
    if (!locked) return;
    var ids = ['business-switch', 'business-chip', 'business-switch-hint'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      el.hidden = true;
      el.setAttribute('hidden', '');
      el.style.display = 'none';
    }
  }

  var kickedAt = 0;
  function sendWaiting() {
    var SR = window.SR;
    if (SR && SR._explicitSignOut) return;
    if (!SR || !SR.sync || !SR.api || !SR.store || !SR.store.outboxCount) return;
    var now = Date.now();
    if (now - kickedAt < 15000) return;
    SR.store.outboxCount().then(function (waiting) {
      if (!waiting) return;
      var probe = SR.api.probe ? SR.api.probe({ force: true }) : Promise.resolve(SR.api.isOnline && SR.api.isOnline());
      Promise.resolve(probe).then(function (up) {
        if (!up) return;
        if (now - kickedAt < 15000) return;
        kickedAt = Date.now();
        if (SR.api.hasToken && SR.api.hasToken()) {
          var run = SR.sync.resumeAfterLine || SR.sync.runOnce;
          if (run) run.call(SR.sync, { silent: true, catchUp: true }).catch(function () {});
          return;
        }
        if (!window.SR || !window.SR._pinUploadOwned) askPin();
      }).catch(function () {});
    }).catch(function () {});
  }

  function askPin() {
    if (window.SR && window.SR._explicitSignOut) return;
    if (document.getElementById('sr-native-pin')) return;
    var SR = window.SR;
    var user = SR && SR.state && SR.state.user;
    if (!user || !user.username || !SR.api || !SR.api.login) return;
    var box = document.createElement('form');
    box.id = 'sr-native-pin';
    box.setAttribute('autocomplete', 'off');
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:80;background:#f7f4ee;color:#1c1915;border:1px solid #d9d1c3;border-radius:12px;padding:14px;font:14px/1.4 system-ui,sans-serif';
    box.innerHTML = '<strong>Send the offline sales</strong><p style="margin:8px 0">The line is back. Enter your PIN to send the sales saved on this phone. You do not sign out. The PIN is not stored. This account can be on one device, so this sign-in ends it on any other device.</p>';
    var input = document.createElement('input');
    input.type = 'password';
    input.inputMode = 'numeric';
    input.autocomplete = 'current-password';
    input.setAttribute('aria-label', 'PIN');
    input.style.cssText = 'width:100%;box-sizing:border-box;margin:0 0 8px;padding:8px';
    var err = document.createElement('p');
    err.style.cssText = 'color:#8c3b2a;min-height:1.2em;margin:0 0 8px';
    var send = document.createElement('button');
    send.type = 'submit';
    send.textContent = 'Send the sales';
    var stay = document.createElement('button');
    stay.type = 'button';
    stay.textContent = 'Not now';
    stay.style.marginLeft = '8px';
    stay.addEventListener('click', function () { box.remove(); });
    box.appendChild(input);
    box.appendChild(err);
    box.appendChild(send);
    box.appendChild(stay);
    box.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var value = String(input.value || '').trim();
      input.value = '';
      if (!value) { err.textContent = 'Enter your PIN.'; return; }
      send.disabled = true;
      SR.api.login({ username: user.username, pin: value, remember: true }).then(function (result) {
        if (!result || result.offline || !result.token) {
          err.textContent = 'The shop did not accept that PIN. The sales are still on this phone.';
          send.disabled = false;
          return;
        }
        box.remove();
        var run = SR.sync.resumeAfterLine || SR.sync.runOnce;
        if (run) return run.call(SR.sync, { silent: true, catchUp: true });
      }).catch(function (e) {
        err.textContent = (e && e.message) || 'That PIN was not accepted.';
        send.disabled = false;
      });
    });
    (document.body || document.documentElement).appendChild(box);
  }

  window.stockridgeNative = window.stockridgeNative || {};
  if (!window.stockridgeNative.shell) window.stockridgeNative.shell = 'android';
  function keepLoginDoor() {
    var SR = window.SR;
    var signedOut = Boolean(SR && SR._explicitSignOut);
    var user = SR && SR.state && SR.state.user;
    var shell = document.getElementById('shell');
    var login = document.getElementById('login-screen');
    var shellUp = shell && !shell.hidden && shell.style.display !== 'none';
    if (!signedOut && (user || !shellUp)) return;
    if (document.body) document.body.classList.add('is-signed-out');
    if (shell) {
      shell.hidden = true;
      shell.style.setProperty('display', 'none', 'important');
    }
    if (login) {
      login.hidden = false;
      login.style.setProperty('display', 'grid', 'important');
    }
    var pin = document.getElementById('sr-native-pin');
    if (pin && pin.parentNode) pin.parentNode.removeChild(pin);
  }

  function paint() { hideInstall(); hideSwitch(); keepLoginDoor(); }
  paint();
  if (document.documentElement && window.MutationObserver && !window.__srInstallStrip) {
    window.__srInstallStrip = new MutationObserver(paint);
    window.__srInstallStrip.observe(document.documentElement, { childList: true, subtree: true });
  }
  window.addEventListener('online', function () { setTimeout(sendWaiting, 1600); });
  setInterval(function () { hideSwitch(); keepLoginDoor(); sendWaiting(); }, 20000);
})();
