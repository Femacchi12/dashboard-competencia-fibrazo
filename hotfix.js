(() => {
  "use strict";

  const originalFetch = window.fetch.bind(window);
  const rangesByGid = {
    "1091103584": "A1:AA145",  // 01_OPERADORES
    "1372196091": "A1:AF1000", // 02_PLANES_HISTORICO
    "718563813": "A1:Z2500"    // 03_COBERTURA
  };

  const normalizeThousands = (text) =>
    text.replace(/\$?-?\d{1,3}(?:\.\d{3})+(?:,\d+)?/g, value => value.replace(/\./g, ""));

  window.fetch = async (input, init) => {
    const rawUrl = typeof input === "string" ? input : input?.url;
    if (!rawUrl || !rawUrl.includes("/gviz/tq")) {
      return originalFetch(input, init);
    }

    const url = new URL(rawUrl, window.location.href);
    const gid = url.searchParams.get("gid") || "";

    // Evita que Google infiera varias filas como encabezado cuando hay columnas de texto.
    url.searchParams.set("headers", "1");

    // Acota cada fuente a su rango maestro para que la estructura sea estable.
    if (rangesByGid[gid]) url.searchParams.set("range", rangesByGid[gid]);

    const response = await originalFetch(url.toString(), init);
    if (!response.ok) return response;

    const tqx = url.searchParams.get("tqx") || "";
    if (!tqx.includes("out:csv")) return response;

    let text = await response.text();

    // En planes, Google devuelve COP formateado como $130.000. app.js espera valor numérico;
    // quitamos solo puntos usados como separador de miles dentro de números.
    if (gid === "1372196091") text = normalizeThousands(text);

    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
})();
