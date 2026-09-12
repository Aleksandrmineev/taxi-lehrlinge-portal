(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  const buttons = [...document.querySelectorAll("[data-install-app]")];
  if (!buttons.length) return;

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone) return;

  let deferredPrompt = null;
  buttons.forEach((button) => { button.hidden = false; });

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
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    buttons.forEach((item) => { item.hidden = true; });
  }));

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    buttons.forEach((button) => { button.hidden = true; });
  });
})();
