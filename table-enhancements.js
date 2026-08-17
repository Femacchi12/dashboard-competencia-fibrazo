(() => {
  "use strict";

  const preferredOrder = ["Fecha_Mes", "Operador_Normalizado", "Ciudad", "Departamento"];
  const stickyKeys = ["Fecha_Mes", "Operador_Normalizado", "Ciudad"];
  let scheduled = false;

  function parseCount(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits ? Number(digits) : 0;
  }

  function reorderTable() {
    const headRow = document.querySelector("#table-head tr");
    if (!headRow) return;

    const headers = [...headRow.children];
    const currentKeys = headers.map(th => th.dataset.key).filter(Boolean);
    if (!currentKeys.length) return;

    const desiredKeys = [
      ...preferredOrder.filter(key => currentKeys.includes(key)),
      ...currentKeys.filter(key => !preferredOrder.includes(key))
    ];

    const changed = desiredKeys.some((key, index) => currentKeys[index] !== key);
    const headerMap = new Map(headers.map(th => [th.dataset.key, th]));

    if (changed) {
      const rows = [...document.querySelectorAll("#table-body tr")];
      rows.forEach(row => {
        const cells = [...row.children];
        const cellMap = new Map(currentKeys.map((key, index) => [key, cells[index]]));
        desiredKeys.forEach(key => {
          const cell = cellMap.get(key);
          if (cell) row.appendChild(cell);
        });
      });
      desiredKeys.forEach(key => {
        const th = headerMap.get(key);
        if (th) headRow.appendChild(th);
      });
    }

    const finalHeaders = [...headRow.children];
    const finalKeys = finalHeaders.map(th => th.dataset.key);
    document.querySelectorAll("#table-body tr").forEach(row => {
      [...row.children].forEach((td, index) => {
        if (finalKeys[index]) td.dataset.key = finalKeys[index];
      });
    });
  }

  function reorderColumnPicker() {
    const menu = document.getElementById("columns-menu");
    if (!menu || !menu.children.length) return;

    const items = [...menu.children];
    const itemMap = new Map(items.map(item => {
      const input = item.querySelector("input[data-key]");
      return [input?.dataset.key, item];
    }).filter(([key]) => key));

    const currentKeys = [...itemMap.keys()];
    const desiredKeys = [
      ...preferredOrder.filter(key => currentKeys.includes(key)),
      ...currentKeys.filter(key => !preferredOrder.includes(key))
    ];

    desiredKeys.forEach(key => {
      const item = itemMap.get(key);
      if (item) menu.appendChild(item);
    });
  }

  function applyStickyColumns() {
    const headRow = document.querySelector("#table-head tr");
    if (!headRow) return;

    let left = 0;
    stickyKeys.forEach((key, stickyIndex) => {
      const th = headRow.querySelector(`th[data-key="${key}"]`);
      if (!th) return;

      const width = Math.ceil(th.getBoundingClientRect().width);
      const cells = [th, ...document.querySelectorAll(`#table-body td[data-key="${key}"]`)];
      cells.forEach(cell => {
        cell.style.left = `${left}px`;
        cell.dataset.stickyColumn = String(stickyIndex + 1);
      });
      left += width;
    });
  }

  function updateMoreButton() {
    const count = document.getElementById("table-count");
    const button = document.getElementById("more-btn");
    if (!count || !button) return;

    const match = count.textContent.match(/([\d.,]+)\s+de\s+([\d.,]+)/i);
    if (!match) return;

    const shown = parseCount(match[1]);
    const total = parseCount(match[2]);
    const remaining = Math.max(total - shown, 0);
    const formatted = new Intl.NumberFormat("es-CO").format(remaining);
    const expanded = button.textContent.trim().toLowerCase().startsWith("ver menos");
    const nextText = expanded ? `VER MENOS · ${formatted} POR MOSTRAR` : `VER MÁS (${formatted})`;
    if (button.textContent !== nextText) button.textContent = nextText;
  }

  function enhance() {
    reorderTable();
    reorderColumnPicker();
    applyStickyColumns();
    updateMoreButton();
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhance();
    });
  }

  const style = document.createElement("style");
  style.id = "table-enhancement-styles";
  style.textContent = `
    #table-head th[data-sticky-column],
    #table-body td[data-sticky-column]{
      position:sticky!important;
      background:#0B110F!important;
      background-clip:padding-box!important;
    }
    #table-head th[data-sticky-column]{
      top:0!important;
      z-index:14!important;
      background:#0d1512!important;
    }
    #table-body td[data-sticky-column]{z-index:7!important;}
    #table-head th[data-sticky-column="3"],
    #table-body td[data-sticky-column="3"]{
      box-shadow:9px 0 14px -13px rgba(0,242,154,.9);
      border-right:1px solid #1B3028!important;
    }
    #table-body tr:hover td[data-sticky-column]{background:#0d1713!important;}
    @media (max-width:600px){
      #more-btn{width:100%;}
    }
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener("resize", scheduleEnhance);
  document.addEventListener("DOMContentLoaded", scheduleEnhance);
  scheduleEnhance();
})();
