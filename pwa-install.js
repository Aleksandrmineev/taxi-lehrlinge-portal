(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  const buttons = [...document.querySelectorAll("[data-install-app]")];
  if (!buttons.length) return;

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone) return;

  const installedKey = "mt:student-pwa-installed";
  if (localStorage.getItem(installedKey) === "1") return;

  let deferredPrompt = null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  buttons.forEach((button) => { button.hidden = !isIOS; });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    buttons.forEach((button) => { button.hidden = false; });
  });

  buttons.forEach((button) => button.addEventListener("click", async () => {
    if (!deferredPrompt) {
      document.getElementById("showHelpButton")?.click();
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice?.outcome === "accepted") {
      localStorage.setItem(installedKey, "1");
      buttons.forEach((item) => { item.hidden = true; });
    }
  }));

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    localStorage.setItem(installedKey, "1");
    buttons.forEach((button) => { button.hidden = true; });
  });
})();
