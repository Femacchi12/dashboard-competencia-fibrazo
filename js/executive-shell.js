/* VIS-115: presentation only. Move existing controls; preserve IDs and listeners. */
(() => {
  function init() {
    const header = document.querySelector('.hero-header');
    if (!header || header.querySelector('.user-menu')) return;
    const session = header.querySelector('.auth-session');
    const metrics = header.querySelector('.update-cards');
    const email = document.getElementById('user-email');
    const menu = document.createElement('details');
    menu.className = 'user-menu';
    const summary = document.createElement('summary');
    summary.setAttribute('aria-label', 'Abrir menú de usuario');
    const avatar = document.createElement('span');
    avatar.className = 'user-avatar';
    const chevron = document.createElement('span');
    chevron.className = 'shell-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    summary.append(avatar, chevron);
    const card = document.createElement('div');
    card.className = 'user-menu-card';
    const title = document.createElement('strong');
    title.textContent = 'Mi cuenta';
    card.append(title);
    if (email) card.append(email);
    if (metrics) {
      const health = document.getElementById('source-health');
      if (health) {
        health.classList.add('source-health');
        metrics.querySelector('article')?.insertBefore(health, document.getElementById('refresh-btn'));
      }
      card.append(metrics);
    }
    if (session) card.append(session);
    menu.append(summary, card);
    header.append(menu);
    const heading = header.querySelector('h1');
    if (heading) heading.textContent = 'Competencia';
    const nav = document.createElement('nav');
    nav.className = 'product-nav';
    nav.setAttribute('aria-label', 'Dashboards FIBRAZO');
    const forms = document.createElement('a');
    forms.href = 'https://fibrazo-forms.vercel.app/';
    forms.textContent = 'Formularios ↗';
    const map = document.createElement('a');
    map.href = 'https://fibrazo-forms.vercel.app/?view=map';
    map.textContent = 'Mapa ↗';
    const current = document.createElement('span');
    current.textContent = 'Competencia';
    current.setAttribute('aria-current', 'page');
    nav.append(forms, map, current);
    header.after(nav);
    const update = () => {
      const value = email?.textContent.trim() || '';
      avatar.textContent = /^[a-z0-9]/i.test(value) ? value[0].toUpperCase() : 'F';
      summary.title = value && value !== '—' ? value : 'Mi cuenta';
    };
    if (email) new MutationObserver(update).observe(email, {childList:true, subtree:true, characterData:true});
    update();
    document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); }
    });
    document.getElementById('important-pendings-btn')?.addEventListener('click', () => { menu.open = false; });
  }
  window.FibrazoExecutiveShell = {init};
})();
