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
      // Kein Installationsdialog verfügbar (iPhone, oder auf Android schon einmal abgebrochen):
      // Anleitung direkt beim Abschnitt „App installieren“ öffnen.
      document.getElementById("showHelpButton")?.click();
      const section = document.getElementById("helpInstall");
      if (section) {
        section.classList.add("help-highlight");
        const content = section.closest(".help-dialog__content");
        if (content) content.scrollTop += section.getBoundingClientRect().top - content.getBoundingClientRect().top;
        setTimeout(() => section.classList.remove("help-highlight"), 2500);
      }
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
