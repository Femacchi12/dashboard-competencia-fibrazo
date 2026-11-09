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

  async function isAllowed(user) {
    if(!user?.emailVerified)return false;
    const token=await user.getIdToken();
    const response=await fetch("https://fibrazo-forms.vercel.app/api/dashboard-permissions?dashboard=competencia",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(!response.ok)throw new Error("POLICY_UNAVAILABLE");
    return !!(await response.json()).allowed;
  }

  const dashboardAppVersion = "20261106-reports120";
  const executiveSummaryVersion = "20261031-115";
  const executiveSummaryObserverVersion = "20261031-115";

  window.FibrazoExecutiveShell.init();

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
      window.dispatchEvent(new Event("fibrazo-dashboard-signout"));
      app.classList.add("hidden");
      authGate.classList.remove("hidden");
      userEmail.textContent = "—";
      return;
    }

    let allowed;
    try { allowed=await isAllowed(user); }
    catch (_) { message.textContent="No fue posible verificar los permisos. Intenta nuevamente."; return; }
    if (!allowed) {
      message.textContent = "Acceso denegado. Usa una cuenta @fibrazo.com autorizada.";
      await auth.signOut();
      return;
    }

    userEmail.textContent = user.email || "Usuario autorizado";
    authGate.classList.add("hidden");
    app.classList.remove("hidden");
    loadDashboard();
    window.dispatchEvent(new CustomEvent("fibrazo-dashboard-auth",{detail:{user,dashboard:"competencia"}}));
  });
})();