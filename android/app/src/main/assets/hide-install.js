(function () {
  'use strict';
  window.stockridgeNative = window.stockridgeNative || { shell: 'android' };
  function hideInstallChrome() {
    var ids = ['install-btn', 'nav-install', 'login-install'];
    for (var i = 0; i < ids.length; i += 1) {
      var node = document.getElementById(ids[i]);
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }
  }
  hideInstallChrome();
  if (!window.__stockridgeAndroidObserver && window.MutationObserver) {
    window.__stockridgeAndroidObserver = new MutationObserver(hideInstallChrome);
    window.__stockridgeAndroidObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
}());
