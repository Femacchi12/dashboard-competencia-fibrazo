(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyDBmVNRqmjy_bt2UovRtmZVNpKrCTyNjLU",
    authDomain: "dashboards-fibrazo.firebaseapp.com",
    projectId: "dashboards-fibrazo",
    storageBucket: "dashboards-fibrazo.firebasestorage.app",
    messagingSenderId: "926517595208",
    appId: "1:926517595208:web:c1ae62107ee8bacad51c7d"
  };

  const allowedException = "fernandoemacchi@gmail.com";
  const allowedDomain = "@fibrazo.com";
  const authGate = document.getElementById("auth-gate");
  const app = document.getElementById("app");
  const message = document.getElementById("auth-message");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userEmail = document.getElementById("user-email");

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

  const isAllowed = (email = "") => {
    const normalized = String(email).trim().toLowerCase();
    return normalized === allowedException || normalized.endsWith(allowedDomain);
  };

  const dashboardAppVersion = "20260916-02";
  const executiveSummaryVersion = "20260916-02";
  const executiveSummaryObserverVersion = "20260919-01";

  const installCompactHeader = () => {
    document.querySelector(".hero-copy > p")?.remove();
    document.getElementById("source-health")?.remove();

    if (!document.getElementById("compact-dashboard-header-styles")) {
      const style = document.createElement("style");
      style.id = "compact-dashboard-header-styles";
      style.textContent = `
        .hero-header{
          min-height:0!important;
          padding:12px 18px!important;
          display:grid!important;
          grid-template-columns:minmax(0,1fr) 330px!important;
          grid-template-areas:"copy update" "copy session"!important;
          align-items:center!important;
          column-gap:20px!important;
          row-gap:5px!important;
          overflow:hidden!important;
        }
        .hero-copy{grid-area:copy!important;max-width:none!important;min-width:0!important;}
        .hero-brand{height:26px!important;gap:11px!important;}
        .hero-brand span{font-size:26px!important;}
        .hero-brand i{height:19px!important;}
        .hero-brand b{font-size:11px!important;}
        .hero-copy h1{margin:9px 0 0!important;padding-left:12px!important;font-size:15px!important;line-height:1.25!important;}
        .update-cards{grid-area:update!important;width:330px!important;justify-self:end!important;}
        .update-cards article{min-height:54px!important;padding:9px 108px 9px 14px!important;border-radius:15px!important;}
        .update-cards span{font-size:11px!important;}
        .update-cards b{font-size:14px!important;margin-top:4px!important;}
        .refresh-button{right:10px!important;top:50%!important;bottom:auto!important;min-width:94px!important;height:34px!important;transform:translateY(-50%)!important;border-radius:9px!important;}
        .auth-session{
          grid-area:session!important;
          position:static!important;
          justify-self:end!important;
          align-self:start!important;
          display:flex!important;
          align-items:center!important;
          gap:8px!important;
          font-size:10.5px!important;
          white-space:nowrap!important;
        }
        .auth-session button{padding:5px 9px!important;border-radius:8px!important;font-size:10.5px!important;}
        .orbit{width:150px!important;height:150px!important;right:-88px!important;bottom:-112px!important;}
        @media(max-width:900px){
          .hero-header{
            grid-template-columns:1fr!important;
            grid-template-areas:"copy" "update" "session"!important;
            padding:14px 16px!important;
            row-gap:10px!important;
          }
          .update-cards{width:100%!important;justify-self:stretch!important;margin-top:0!important;}
          .auth-session{justify-self:start!important;align-self:center!important;}
        }
        @media(max-width:560px){
          .hero-header{padding:13px 14px!important;}
          .hero-brand span{font-size:24px!important;}
          .update-cards article{padding:10px!important;}
          .refresh-button{position:static!important;width:100%!important;height:auto!important;min-height:34px!important;margin-top:8px!important;transform:none!important;}
          .auth-session{flex-wrap:wrap!important;white-space:normal!important;}
        }
      `;
      document.head.appendChild(style);
    }

    const lastLoad = document.getElementById("last-load");
    if (lastLoad && lastLoad.dataset.dateOnlyObserver !== "1") {
      lastLoad.dataset.dateOnlyObserver = "1";
      const keepDateOnly = () => {
        const current = String(lastLoad.textContent || "").trim();
        if (!current || current === "—") return;
        const dateOnly = current.split(",")[0].trim();
        if (dateOnly && current !== dateOnly) lastLoad.textContent = dateOnly;
      };
      new MutationObserver(keepDateOnly).observe(lastLoad, { childList: true, characterData: true, subtree: true });
      keepDateOnly();
    }
  };

  installCompactHeader();

  const loadExecutiveSummaryObserver = () => {
    if (document.querySelector('script[data-executive-summary-observer]')) return;
    const observerScript = document.createElement("script");
    observerScript.src = "js/executive-summary-observer.js?v="+encodeURIComponent(executiveSummaryObserverVersion);
    observerScript.dataset.executiveSummaryObserver = "true";
    document.body.appendChild(observerScript);
  };

  const loadExecutiveSummary = () => {
    if (document.querySelector('script[data-executive-summary]')) {
      loadExecutiveSummaryObserver();
      return;
    }
    const summaryScript = document.createElement("script");
    summaryScript.src = "js/executive-summary.js?v="+encodeURIComponent(executiveSummaryVersion);
    summaryScript.dataset.executiveSummary = "true";
    summaryScript.addEventListener("load", loadExecutiveSummaryObserver, { once:true });
    document.body.appendChild(summaryScript);
  };

  const loadDashboard = () => {
    if (document.querySelector('script[data-dashboard-app]')) {
      if (window.FZ?.app) loadExecutiveSummary();
      return;
    }
    const script = document.createElement("script");
    script.src = "js/app.js?v="+encodeURIComponent(dashboardAppVersion);
    script.dataset.dashboardApp = "true";
    script.addEventListener("load", loadExecutiveSummary, { once:true });
    document.body.appendChild(script);
  };

  loginBtn.addEventListener("click", async () => {
    message.textContent = "";
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await auth.signInWithPopup(provider);
    } catch (error) {
      message.textContent = "No fue posible iniciar sesión. Intenta nuevamente.";
      console.error(error);
    }
  });

  logoutBtn.addEventListener("click", () => auth.signOut());

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      app.classList.add("hidden");
      authGate.classList.remove("hidden");
      userEmail.textContent = "—";
      return;
    }

    if (!isAllowed(user.email)) {
      message.textContent = "Acceso denegado. Usa una cuenta @fibrazo.com autorizada.";
      await auth.signOut();
      return;
    }

    userEmail.textContent = user.email || "Usuario autorizado";
    authGate.classList.add("hidden");
    app.classList.remove("hidden");
    loadDashboard();
  });
})();