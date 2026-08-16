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

  const loadDashboard = () => {
    if (document.querySelector('script[data-dashboard-app]')) return;
    const script = document.createElement("script");
    script.src = "app.js";
    script.dataset.dashboardApp = "true";
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
