const IVA = 1.16;
const { DATA, SPERM, META } = window.FI_DATA;
const SEM = window.FI_DATA.SEMEN_OVO && window.FI_DATA.SEMEN_OVO.donors && window.FI_DATA.SEMEN_OVO.donors.length ? window.FI_DATA.SEMEN_OVO : null;
const $ = id => document.getElementById(id);
const fmt = n => n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("es-MX");
const pct = n => n == null || isNaN(n) ? "N/D" : (n * 100).toFixed(1) + "%";
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Catálogo de productos por empresa ---------- */
const COMPANIES = ["OCP", "LAFER", "GENEVITY", "OVODONORS"];
const PRODUCTS = [
  { id: "OCP_F", co: "OCP", tipo: "ovulos", estados: ["fresco"], name: "Óvulos frescos", desc: "Paquete por categoría",
    from: Math.min(...DATA.OCPF.cats.map(c => c.p)), link: DATA.OCPF.link },
  { id: "OCP_C", co: "OCP", tipo: "ovulos", estados: ["congelado"], name: "Óvulos congelados", desc: "Precio por unidad",
    from: Math.min(...DATA.OCPC.cats.map(c => c.p)), link: DATA.OCPC.link },
  { id: "LAFER_S", co: "LAFER", tipo: "semen", estados: ["congelado"], name: "Semen congelado", desc: "Por vial + traslado",
    from: Math.min(...SPERM.LAFER.origins.map(o => o.p)), link: SPERM.LAFER.link },
  { id: "GEN_S", co: "GENEVITY", tipo: "semen", estados: ["congelado"], name: "Semen congelado", desc: "European Sperm Bank · por vial",
    from: Math.min(...SPERM.GENEVITY.origins.map(o => o.p)), link: SPERM.GENEVITY.link },
  { id: "OVO_O", co: "OVODONORS", tipo: "ovulos", estados: ["fresco", "congelado"], name: "Óvulos", desc: "Por donante: lote o por óvulo",
    from: Math.min(...DATA.OVO.donors.map(d => d.unit)), fromLabel: "por óvulo", link: DATA.OVO.link },
  SEM ? { id: "OVO_S", co: "OVODONORS", tipo: "semen", estados: ["fresco", "congelado"], name: "Semen", desc: `Catálogo por rasgos · ${SEM.donors.length} perfiles`,
    from: Math.min(...SEM.donors.filter(d => d.estatus !== "Vendido").map(d => d.precio)), link: DATA.OVO.link }
  : { id: "OVO_S", co: "OVODONORS", tipo: "semen", estados: ["fresco", "congelado"], name: "Semen", desc: "Precio a solicitar con Ana",
    from: null, link: DATA.OVO.link, noPrice: true },
];
const P = id => PRODUCTS.find(p => p.id === id);

/* ---------- Estado ---------- */
const S = {
  fTipo: "", fEstado: "", prod: "OVO_O", showSold: true,
  sem: { f: {}, edadMin: "", edadMax: "", altMin: "", altMax: "", sel: null, estado: "congelado", sort: "precio", more: false },
  ocpfCat: 0, ocpfQty: 1, ocpcCat: 0, ocpcQty: 6,
  donor: 739, ovoMode: "lote", ovoQty: 6, ovoEstado: "congelado", sort: "unit",
  spOrigin: { LAFER_S: 2, GEN_S: 2 }, spQty: { LAFER_S: 1, GEN_S: 1 },
  lines: [], opts: []
};
try { const s = JSON.parse(localStorage.getItem("fi_cot_int") || "null"); if (s != null) $("internal").checked = s } catch (e) {}

/* ---------- Inventario compartido (Google Sheet) ---------- */
const CFG = window.FI_CONFIG || {};
const INV = { ventas: [], at: null, err: null, busy: false };
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function stockOf(d) {
  const av = d.av || "", m = av.match(/Disponibles:\s*(\d+)/i);
  if (m) return +m[1];
  let t = 0, x; const re = /(\d+)\s*packs?\s*de\s*(\d+)/gi;
  while ((x = re.exec(av))) t += x[1] * x[2];
  return t || d.eggs;
}
const soldOf = code => INV.ventas.filter(v => v.status === "vendido" && String(v.donante) === String(code)).reduce((s, v) => s + Number(v.cantidad || 0), 0);
const inCart = code => S.lines.filter(l => l.donor === code).reduce((s, l) => s + l.eggs, 0);
const leftOf = d => Math.max(0, stockOf(d) - soldOf(d.code));
const canSell = (d, q) => leftOf(d) - inCart(d.code) >= q;
function renderSync() {
  const el = $("sync"), t = $("syncTxt");
  el.className = "sync" + (!CFG.ventasUrl ? "" : INV.busy ? " busy" : INV.err ? " err" : INV.at ? " on" : " busy");
  t.textContent = !CFG.ventasUrl ? "Inventario sin conectar" : INV.busy ? "Sincronizando…" : INV.err ? INV.err
    : INV.at ? `Inventario al día · ${INV.at.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Conectando…";
}
async function loadInv(silent) {
  if (!CFG.ventasUrl) { renderSync(); renderSales(); return }
  INV.busy = true; renderSync();
  try {
    const r = await fetch(CFG.ventasUrl + (CFG.ventasUrl.includes("?") ? "&" : "?") + "t=" + Date.now());
    const j = await r.json(); if (!j.ok) throw new Error(j.error || "Respuesta inválida");
    INV.ventas = j.ventas || []; INV.err = null; INV.at = new Date();
  } catch (e) { INV.err = "No se pudo leer el inventario" }
  INV.busy = false; afterInv(silent);
}
async function postInv(body) {
  INV.busy = true; renderSync();
  try {
    const r = await fetch(CFG.ventasUrl, { method: "POST", body: JSON.stringify(body) });
    const j = await r.json(); if (j.ventas) { INV.ventas = j.ventas; INV.at = new Date(); INV.err = null }
    return j;
  } catch (e) { return { ok: false, error: "Sin conexión con el inventario. Intenta de nuevo." } }
  finally { INV.busy = false; afterInv() }
}
function afterInv(silent) {
  renderSync(); renderSales(); finder(); calc();
  const typing = document.activeElement && $("cfg").contains(document.activeElement) && document.activeElement.tagName === "INPUT";
  if (!(silent && typing)) { pickAvailableDonor(); renderCfg() }
}
const quickSold = code => INV.ventas.filter(v => v.status === "vendido" && String(v.donante) === String(code) && v.modalidad === "Marcada vendida");
async function quickMark(code, btn) {
  if (!CFG.ventasUrl) { toast("Falta conectar el inventario (config.js) para que todas vean lo vendido"); return }
  const d = DATA.OVO.donors.find(x => x.code === code), L = leftOf(d);
  btn.disabled = true; btn.textContent = "Guardando…";
  const j = await postInv({ action: "vender", items: [{ donante: code, cantidad: L, modalidad: "Marcada vendida", estado: "", stock: stockOf(d) }],
    paciente: $("patient").value.trim(), ejecutiva: $("seller").value.trim() || "Sin nombre" });
  toast(j.ok ? `Donante #${code} marcada como vendida` : j.error || "No se pudo guardar");
}
async function quickUndo(code, btn) {
  btn.disabled = true; btn.textContent = "Guardando…";
  let ok = true;
  for (const v of quickSold(code)) { const j = await postInv({ action: "liberar", id: v.id, ejecutiva: $("seller").value.trim() }); ok = ok && j.ok }
  toast(ok ? `Donante #${code} disponible otra vez` : "No se pudo reactivar");
}
/* ---------- Semen Ovodonors (catálogo por rasgos) ---------- */
const SEM_F = [
  ["etnia", "Etnicidad"], ["ojos", "Color de ojos"], ["cabello", "Color de cabello"], ["piel", "Color de piel"], ["categoria", "Categoría"],
  ["tipoCabello", "Tipo de cabello", 1], ["complexion", "Complexión", 1], ["sangre", "Tipo de sangre", 1], ["tatuajes", "Tatuajes", 1], ["documento", "Documento migratorio", 1]
];
const semKey = d => "S-" + d.id;
const semLeft = d => d.estatus === "Vendido" ? 0 : Math.max(0, 1 - soldOf(semKey(d)));
const semTokens = (k, v) => k === "ojos" ? String(v).split("/").map(x => x.trim()) : [v];
function semMatch(d) {
  const F = S.sem.f;
  for (const [k] of SEM_F) if (F[k] && !semTokens(k, d[k]).includes(F[k])) return false;
  const n = (v, x, cmp) => v === "" || v == null || x == null || cmp(x, +v);
  return n(S.sem.edadMin, d.edad, (x, v) => x >= v) && n(S.sem.edadMax, d.edad, (x, v) => x <= v) &&
    n(S.sem.altMin, d.altura, (x, v) => x >= v) && n(S.sem.altMax, d.altura, (x, v) => x <= v);
}
function semOptions(k) {
  const c = {};
  SEM.donors.filter(d => semLeft(d) > 0).forEach(d => semTokens(k, d[k]).forEach(t => { if (t) c[t] = (c[t] || 0) + 1 }));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function semEnsureSel() {
  const cur = SEM.donors.find(d => d.id === S.sem.sel);
  if (cur && semLeft(cur) > 0 && semMatch(cur)) return;
  const first = SEM.donors.filter(d => semLeft(d) > 0 && semMatch(d)).sort((a, b) => a.precio - b.precio)[0];
  S.sem.sel = first ? first.id : null;
}
function renderSemCfg() {
  semEnsureSel();
  const all = SEM.donors.filter(semMatch), avail = all.filter(d => semLeft(d) > 0);
  const sortF = { precio: (a, b) => a.precio - b.precio, edad: (a, b) => a.edad - b.edad, altura: (a, b) => b.altura - a.altura, id: (a, b) => a.id.localeCompare(b.id) }[S.sem.sort];
  const rows = all.slice().sort(sortF).sort((a, b) => (semLeft(a) === 0) - (semLeft(b) === 0)).filter(d => S.showSold || semLeft(d) > 0);
  const sel = SEM.donors.find(d => d.id === S.sem.sel);
  const estados = S.fEstado ? [S.fEstado] : ["fresco", "congelado"];
  const sf = ([k, label, more]) => `<div class="field" ${more && !S.sem.more ? "hidden" : ""}><label class="l" for="sf_${k}">${label}</label><select id="sf_${k}" data-k="${k}"><option value="">Cualquiera</option>${semOptions(k).map(([v, n]) => `<option value="${esc(v)}" ${S.sem.f[k] === v ? "selected" : ""}>${esc(v)} (${n})</option>`).join("")}</select></div>`;
  const nf = (id, label, v) => `<div class="field" ${!S.sem.more ? "hidden" : ""}><label class="l" for="${id}">${label}</label><input type="number" id="${id}" value="${v}" placeholder="—"></div>`;
  const activeF = Object.values(S.sem.f).filter(Boolean).length + ["edadMin", "edadMax", "altMin", "altMax"].filter(k => S.sem[k] !== "").length;
  return `<div class="semf">${SEM_F.map(sf).join("")}
      ${nf("sEdadMin", "Edad mínima", S.sem.edadMin)}${nf("sEdadMax", "Edad máxima", S.sem.edadMax)}${nf("sAltMin", "Altura mín. (cm)", S.sem.altMin)}${nf("sAltMax", "Altura máx. (cm)", S.sem.altMax)}</div>
    <div class="row" style="align-items:center;justify-content:space-between">
      <div class="btns"><button class="btn ghost mini" id="semMore">${S.sem.more ? "Menos filtros" : "Más filtros"}</button>${activeF ? `<button class="btn ghost mini" id="semClear">Limpiar filtros (${activeF})</button>` : ""}</div>
      <span class="note"><b>${avail.length}</b> perfiles disponibles coinciden</span>
      <div class="fgroup"><div class="seg" role="group" aria-label="Estado de la muestra" id="semEst">${estados.map(e => `<button data-e="${e}" aria-pressed="${S.sem.estado === e}">${cap(e)}</button>`).join("")}</div></div>
    </div>
    <div class="tbl-wrap"><table><thead><tr>
      <th data-ss="id">Perfil</th><th></th><th class="r" data-ss="precio">Precio c/IVA</th><th>Categoría</th><th class="r" data-ss="edad">Edad</th><th>Etnicidad</th><th>Ojos</th><th>Cabello</th><th>Piel</th><th class="r" data-ss="altura">Altura</th><th>Sangre</th>
    </tr></thead><tbody>${rows.length ? rows.map(d => { const L = semLeft(d);
      return `<tr data-sid="${d.id}" class="${L === 0 ? "soldout" : d.id === S.sem.sel ? "sel" : ""}"><td class="num">${d.id}</td>
      <td>${L === 0 ? (quickSold(semKey(d)).length ? `<button class="btn ghost mini" data-sundo="${d.id}">Reactivar</button>` : '<span class="pill bad">Vendido</span>') : `<button class="btn mini soldbtn" data-ssold="${d.id}">Marcar vendido</button>`}</td>
      <td class="r num">${fmt(d.precio)}</td><td><span class="pill cat-${d.categoria === "Élite" ? "e" : d.categoria === "Premium" ? "p" : "s"}">${esc(d.categoria)}</span></td>
      <td class="r num">${d.edad ?? "—"}</td><td>${esc(d.etnia)}</td><td>${esc(d.ojos)}</td><td>${esc(d.cabello)}</td><td>${esc(d.piel)}</td><td class="r num">${d.altura ?? "—"}</td><td>${esc(d.sangre)}</td></tr>` }).join("")
      : `<tr><td colspan="11" class="note" style="white-space:normal">Ningún perfil cumple todos los rasgos. Quita algún filtro (empieza por los de «Más filtros»).</td></tr>`}</tbody></table></div>
    ${sel ? `<div class="semdet"><div class="eyebrow">Perfil ${sel.id} · ${esc(sel.categoria)}</div>
      <div class="semgrid">
        <span><b>Etnicidad</b>${esc(sel.etniaDet || sel.etnia)}</span><span><b>Edad</b>${sel.edad ?? "—"} años</span>
        <span><b>Altura / peso</b>${sel.altura ?? "—"} cm · ${sel.peso ?? "—"} kg</span><span><b>Complexión</b>${esc(sel.complexion)}</span>
        <span><b>Ojos / cabello</b>${esc(sel.ojos)} · ${esc(sel.cabello)} ${esc(sel.tipoCabello).toLowerCase()}</span><span><b>Sangre</b>${esc(sel.sangre)}</span>
        <span><b>Estudios</b>${esc(sel.estudio)}</span><span><b>Ocupación</b>${esc(sel.ocupacion)}</span>
        <span><b>Tatuajes</b>${esc(sel.tatuajes)}</span><span><b>Documento migratorio</b>${esc(sel.documento)}</span>
      </div></div>` : ""}
    <div class="note">Precio = (compensación + envío ${fmt(SEM.envio)}) ÷ (1 − ${Math.round(SEM.margen * 100)}%) × (1 + IVA ${Math.round(SEM.iva * 100)}%). No incluye el tratamiento (IUI / ICI / FIV / ICSI), que se cotiza aparte.</div>`;
}
function bindSemCfg(el) {
  el.querySelectorAll(".semf select").forEach(x => x.onchange = () => { S.sem.f[x.dataset.k] = x.value; renderCfg() });
  [["sEdadMin", "edadMin"], ["sEdadMax", "edadMax"], ["sAltMin", "altMin"], ["sAltMax", "altMax"]].forEach(([id, k]) => { const i = $(id); if (i) i.onchange = () => { S.sem[k] = i.value; renderCfg() } });
  const m = $("semMore"); if (m) m.onclick = () => { S.sem.more = !S.sem.more; renderCfg() };
  const c = $("semClear"); if (c) c.onclick = () => { S.sem.f = {}; S.sem.edadMin = S.sem.edadMax = S.sem.altMin = S.sem.altMax = ""; renderCfg() };
  el.querySelectorAll("#semEst button").forEach(x => x.onclick = () => { S.sem.estado = x.dataset.e; renderCfg() });
  el.querySelectorAll("tr[data-sid]:not(.soldout)").forEach(x => x.onclick = () => { S.sem.sel = x.dataset.sid; renderCfg() });
  el.querySelectorAll("th[data-ss]").forEach(x => x.onclick = () => { S.sem.sort = x.dataset.ss; renderCfg() });
  el.querySelectorAll("[data-ssold]").forEach(b => b.onclick = ev => { ev.stopPropagation(); semMark(b.dataset.ssold, b) });
  el.querySelectorAll("[data-sundo]").forEach(b => b.onclick = ev => { ev.stopPropagation(); semUndo(b.dataset.sundo, b) });
}
async function semMark(id, btn) {
  if (!CFG.ventasUrl) { toast("Falta conectar el inventario (config.js) para que todas vean lo vendido"); return }
  btn.disabled = true; btn.textContent = "Guardando…";
  const j = await postInv({ action: "vender", items: [{ donante: "S-" + id, cantidad: 1, modalidad: "Marcada vendida", estado: "semen", stock: 1 }],
    paciente: $("patient").value.trim(), ejecutiva: $("seller").value.trim() || "Sin nombre" });
  toast(j.ok ? `Perfil de semen ${id} marcado como vendido` : j.error || "No se pudo guardar");
}
async function semUndo(id, btn) {
  btn.disabled = true; btn.textContent = "Guardando…";
  let ok = true;
  for (const v of quickSold("S-" + id)) { const j = await postInv({ action: "liberar", id: v.id, ejecutiva: $("seller").value.trim() }); ok = ok && j.ok }
  toast(ok ? `Perfil ${id} disponible otra vez` : "No se pudo reactivar");
}

function pickAvailableDonor() {
  const d = DATA.OVO.donors.find(x => x.code === S.donor);
  if (d && leftOf(d) > 0) return;
  const alt = DATA.OVO.donors.slice().sort((a, b) => a.unit - b.unit).find(x => leftOf(x) > 0);
  if (alt) S.donor = alt.code;
}
function renderSales() {
  const el = $("sales");
  if (!CFG.ventasUrl) {
    el.innerHTML = `<div class="setup">El registro de ventas aún no está conectado. Para activarlo, sigue los pasos de <code>LEEME-VENDIDOS.md</code> y pega la URL del Apps Script en <code>config.js</code>. Mientras tanto, el cotizador funciona con la disponibilidad del Excel.</div>`;
    return;
  }
  const v = INV.ventas.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  if (!v.length) { el.innerHTML = `<div class="empty">Sin ventas registradas todavía. Usa «Registrar venta» en la cotización actual.</div>`; return }
  el.innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Donante</th><th class="r">Óvulos</th><th>Modalidad</th><th>Estado</th><th>Ejecutiva</th><th>Status</th><th></th></tr></thead><tbody>${v.map(x => {
    const f = x.fecha ? new Date(x.fecha).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
    const act = x.status === "vendido";
    return `<tr class="${act ? "" : "released"}" style="cursor:default"><td>${f}</td><td class="num">${String(x.donante).startsWith("S-") ? "Semen " + esc(String(x.donante).slice(2)) : "Óvulos #" + esc(x.donante)}</td><td class="r num">${esc(x.cantidad)}</td><td>${esc(x.modalidad)}</td><td>${esc(x.estado_muestra)}</td><td>${esc(x.ejecutiva)}</td>
      <td>${act ? '<span class="pill bad">Vendido</span>' : `<span class="pill">Liberado${x.liberado_por ? " · " + esc(x.liberado_por) : ""}</span>`}</td>
      <td>${act ? `<button class="btn ghost mini" data-rel="${esc(x.id)}">Liberar</button>` : ""}</td></tr>`;
  }).join("")}</tbody></table></div>`;
  el.querySelectorAll("[data-rel]").forEach(b => b.onclick = async () => {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "¿Liberar? Toca otra vez"; setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Liberar" } }, 4000); return }
    b.disabled = true;
    const j = await postInv({ action: "liberar", id: b.dataset.rel, ejecutiva: $("seller").value.trim() });
    toast(j.ok ? "Venta liberada: el inventario vuelve a estar disponible" : j.error || "No se pudo liberar");
  });
}

const matches = p => (!S.fTipo || p.tipo === S.fTipo) && (!S.fEstado || p.estados.includes(S.fEstado));

/* ---------- Filtros ---------- */
function bindSeg(id, key) {
  $(id).querySelectorAll("button").forEach(b => b.onclick = () => {
    S[key] = b.dataset.v;
    $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
    if (key === "fEstado" && S.fEstado) S.ovoEstado = S.fEstado;
    const cur = P(S.prod);
    if (!matches(cur)) { const first = PRODUCTS.find(p => matches(p) && !p.noPrice); if (first) S.prod = first.id }
    renderCompanies(); renderCfg(); finder();
  });
}

/* ---------- Empresas y productos ---------- */
function tags(p) {
  return `<span class="pill">${p.tipo === "ovulos" ? "Óvulos" : "Semen"}</span>` +
    p.estados.map(e => `<span class="pill ${e}">${cap(e)}</span>`).join("");
}
function renderCompanies() {
  let shown = 0;
  const ps = COMPANIES.flatMap(co => PRODUCTS.filter(p => p.co === co && matches(p)));
  shown = ps.length;
  $("companies").innerHTML = ps.length ? `<div class="prods">${ps.map(p => `<button class="bank" data-id="${p.id}" aria-pressed="${S.prod === p.id}" ${p.noPrice ? "disabled" : ""}>
        <span class="eyebrow co">${p.co}</span><b>${p.name}</b><span>${p.desc}</span><div class="tags">${tags(p)}</div>
        <div class="from">${p.from != null ? "Desde " + fmt(p.from) + (p.fromLabel ? " " + p.fromLabel : "") : "Solicitar precio"}</div>
      </button>`).join("")}</div>` : `<div class="empty">Ningún producto con esta combinación de filtros.</div>`;
  $("fCount").textContent = `${shown} de ${PRODUCTS.length} productos`;
  $("companies").querySelectorAll(".bank:not([disabled])").forEach(el => el.onclick = () => {
    S.prod = el.dataset.id; renderCompanies(); renderCfg();
  });
}

/* ---------- Configurador del producto ---------- */
function catSelect(id, cats, sel) {
  return `<select id="${id}">${cats.map((c, i) => `<option value="${i}" ${i == sel ? "selected" : ""}>${c.c} — ${fmt(c.p)}</option>`).join("")}</select>`;
}
function renderCfg() {
  const p = P(S.prod), el = $("cfg");
  if (!matches(p) || p.noPrice) { el.innerHTML = ""; return }
  let h = `<div class="step-h"><span class="step-n">2</span><h2>${p.co} · ${p.name}</h2></div>`;
  if (p.id === "OCP_F") {
    h += `<div class="row"><div class="field"><label class="l" for="ocpfCat">Categoría</label>${catSelect("ocpfCat", DATA.OCPF.cats, S.ocpfCat)}</div>
      <div class="field" style="flex:0 1 120px"><label class="l" for="ocpfQty">Paquetes</label><input type="number" id="ocpfQty" min="1" max="3" value="${S.ocpfQty}"></div></div>
      <div class="note">Precio por paquete de óvulos, IVA incluido. El número de óvulos por paquete depende de la categoría: confírmalo en el catálogo.</div>`;
  } else if (p.id === "OCP_C") {
    h += `<div class="row"><div class="field"><label class="l" for="ocpcCat">Categoría</label>${catSelect("ocpcCat", DATA.OCPC.cats, S.ocpcCat)}</div>
      <div class="field" style="flex:0 1 120px"><label class="l" for="ocpcQty">Unidades</label><input type="number" id="ocpcQty" min="1" max="20" value="${S.ocpcQty}"></div></div>
      <div class="note">Precio unitario con IVA. Confirma con OCP si la unidad es óvulo individual o vial.</div>`;
  } else if (p.id === "LAFER_S" || p.id === "GEN_S") {
    const src = p.id === "LAFER_S" ? SPERM.LAFER : SPERM.GENEVITY, o = src.origins[S.spOrigin[p.id]] || src.origins[0];
    h += `<div class="row"><div class="field"><label class="l" for="spOrigin">Origen</label><select id="spOrigin">${src.origins.map((x, i) =>
        `<option value="${i}" ${i == S.spOrigin[p.id] ? "selected" : ""}>${x.o} — ${fmt(x.p)}/vial</option>`).join("")}</select></div>
      <div class="field" style="flex:0 1 110px"><label class="l" for="spQty">Viales</label><input type="number" id="spQty" min="1" max="10" value="${S.spQty[p.id]}"></div></div>
      <div class="note">${[o.ship ? `Traslado +${fmt(o.ship)} (una vez por envío)` : "", o.t].filter(Boolean).join(" · ")}</div>`;
  } else if (p.id === "OVO_O") {
    const all = DATA.OVO.donors.slice().sort((a, c) => S.sort === "unit" ? a.unit - c.unit : S.sort === "pack" ? a.pack - c.pack : S.sort === "eggs" ? c.eggs - a.eggs : S.sort === "left" ? leftOf(c) - leftOf(a) : a.code - c.code);
    all.sort((a, c) => (leftOf(a) === 0) - (leftOf(c) === 0));
    const soldOut = all.filter(x => leftOf(x) === 0), d = S.showSold ? all : all.filter(x => leftOf(x) > 0);
    const estados = S.fEstado ? [S.fEstado] : ["fresco", "congelado"];
    h += `<div class="row" style="align-items:flex-end;justify-content:space-between">
        <div class="fgroup"><span class="l">Modalidad</span><div class="seg" role="group" aria-label="Modalidad" id="ovoMode"><button data-m="lote" aria-pressed="${S.ovoMode === "lote"}">Lote completo</button><button data-m="unit" aria-pressed="${S.ovoMode === "unit"}">Por óvulo</button></div></div>
        <div class="fgroup"><span class="l">Estado</span><div class="seg" role="group" aria-label="Estado Ovodonors" id="ovoEst">${estados.map(e => `<button data-e="${e}" aria-pressed="${S.ovoEstado === e}">${cap(e)}</button>`).join("")}</div></div>
        <div class="field" style="flex:0 1 110px" ${S.ovoMode === "lote" ? "hidden" : ""}><label class="l" for="ovoQty">Óvulos</label><input type="number" id="ovoQty" min="1" max="${Math.max(1, leftOf(DATA.OVO.donors.find(x => x.code === S.donor)))}" value="${S.ovoQty}"></div>
      </div>
      <div class="note">Toca una donante para seleccionarla. Ordena tocando el encabezado. Confirma con Ana si la donante está disponible en fresco o congelado.</div>
      <div class="tbl-wrap"><table><thead><tr>
        <th data-s="code">Donante</th><th></th><th class="r" data-s="eggs">Óvulos</th><th class="r" data-s="pack">Lote c/IVA</th><th class="r" data-s="unit">Unit. c/IVA</th><th class="r" data-s="left">Quedan</th><th>Packs (Excel)</th>
      </tr></thead><tbody>${d.map(x => { const L = leftOf(x), sold = soldOf(x.code);
        return `<tr data-c="${x.code}" class="${L === 0 ? "soldout" : x.code === S.donor ? "sel" : ""}"><td class="num">#${x.code}</td><td>${L === 0 ? (quickSold(x.code).length ? `<button class="btn ghost mini" data-undo="${x.code}">Reactivar</button>` : "") : `<button class="btn mini soldbtn" data-sold="${x.code}">Marcar vendida</button>`}</td><td class="r num">${x.eggs}</td><td class="r num">${fmt(x.pack)}</td><td class="r num">${fmt(x.unit)}</td>
        <td class="r">${L === 0 ? '<span class="pill bad">Vendida</span>' : `<span class="num">${L}</span>${sold ? ` <span class="note">(−${sold})</span>` : ""}`}</td>
        <td>${x.av ? `<span class="pill">${x.av}</span>` : `<span class="pill">Lote completo</span>`}</td></tr>` }).join("")}</tbody></table></div>
      ${soldOut.length ? `<label class="toggle"><input type="checkbox" id="showSold" ${S.showSold ? "checked" : ""}> Mostrar vendidas (${soldOut.length})</label>` : ""}
      <div class="note">«Marcar vendida» marca a la donante como vendida para todas las ejecutivas con un clic. «Reactivar» la regresa a disponible.</div>`;
  } else if (p.id === "OVO_S" && SEM) {
    h += renderSemCfg();
  }
  const ln = currentLine();
  h += ln ? `<div class="addbar"><div><div class="note">${esc(ln.label)}</div><div class="num">${fmt(ln.p)}</div></div>
        <button class="btn" id="addLine">Agregar a la cotización</button></div>`
      : `<div class="addbar"><div class="note">Selecciona un perfil disponible para agregarlo.</div><button class="btn" id="addLine" disabled>Agregar a la cotización</button></div>`;
  el.innerHTML = h;

  const on = (id, fn) => { const i = $(id); if (i) i.oninput = () => { fn(+i.value); refreshAddbar() } };
  on("ocpfCat", v => S.ocpfCat = v); on("ocpfQty", v => S.ocpfQty = v);
  on("ocpcCat", v => S.ocpcCat = v); on("ocpcQty", v => S.ocpcQty = v);
  on("ovoQty", v => S.ovoQty = v);
  on("spQty", v => S.spQty[S.prod] = v);
  const so = $("spOrigin"); if (so) so.onchange = () => { S.spOrigin[S.prod] = +so.value; renderCfg() };
  el.querySelectorAll("#ovoMode button").forEach(x => x.onclick = () => { S.ovoMode = x.dataset.m; renderCfg() });
  el.querySelectorAll("#ovoEst button").forEach(x => x.onclick = () => { S.ovoEstado = x.dataset.e; renderCfg() });
  el.querySelectorAll("tr[data-c]:not(.soldout)").forEach(x => x.onclick = () => { S.donor = +x.dataset.c; renderCfg() });
  el.querySelectorAll("[data-sold]").forEach(b => b.onclick = ev => { ev.stopPropagation(); quickMark(+b.dataset.sold, b) });
  el.querySelectorAll("[data-undo]").forEach(b => b.onclick = ev => { ev.stopPropagation(); quickUndo(+b.dataset.undo, b) });
  const ss = $("showSold"); if (ss) ss.onchange = () => { S.showSold = ss.checked; renderCfg() };
  el.querySelectorAll("th[data-s]").forEach(x => x.onclick = () => { S.sort = x.dataset.s; renderCfg() });
  if (p.id === "OVO_S" && SEM) bindSemCfg(el);
  $("addLine").onclick = () => { if (addLines()) toast("Agregado a la cotización") };
}
function refreshAddbar() {
  const ln = currentLine(), bar = document.querySelector(".addbar");
  if (bar && ln) { bar.querySelector(".note").textContent = ln.label; bar.querySelector(".num").textContent = fmt(ln.p) }
}

/* ---------- Construcción de líneas ---------- */
function currentLine() {
  const id = S.prod;
  if (id === "OCP_F") {
    const c = DATA.OCPF.cats[S.ocpfCat], q = Math.max(1, S.ocpfQty || 1);
    return { co: "OCP", tipo: "ovulos", estado: "fresco", label: `OCP · Óvulos frescos · ${c.c} × ${q} paquete${q > 1 ? "s" : ""}`, p: c.p * q, cost: null, eggs: null };
  }
  if (id === "OCP_C") {
    const c = DATA.OCPC.cats[S.ocpcCat], q = Math.max(1, S.ocpcQty || 1);
    return { co: "OCP", tipo: "ovulos", estado: "congelado", label: `OCP · Óvulos congelados · ${c.c} × ${q}`, p: c.p * q, cost: c.cost != null ? c.cost * q : null, eggs: q };
  }
  if (id === "OVO_O") {
    const d = DATA.OVO.donors.find(x => x.code === S.donor), e = S.ovoEstado;
    if (S.ovoMode === "lote") return { co: "OVODONORS", tipo: "ovulos", estado: e, label: `Ovodonors · Óvulos ${e}s · Donante #${d.code} · lote ${d.eggs}`, p: d.pack, cost: d.cost ?? null, eggs: d.eggs, donor: d.code, mode: "Lote completo" };
    const q = Math.max(1, Math.min(Math.max(d.eggs, leftOf(d)), S.ovoQty || 1));
    return { co: "OVODONORS", tipo: "ovulos", estado: e, label: `Ovodonors · Óvulos ${e}s · Donante #${d.code} · ${q} óvulos`, p: d.unit * q, cost: d.cost != null ? d.cost / d.eggs * q : null, eggs: q, donor: d.code, mode: "Por óvulo" };
  }
  if (id === "OVO_S" && SEM) {
    const d = SEM.donors.find(x => x.id === S.sem.sel);
    if (!d) return null;
    const e = S.sem.estado;
    return { co: "OVODONORS", tipo: "semen", estado: e, label: `Ovodonors · Semen ${e} · Perfil ${d.id} (${d.categoria})`, p: d.precio, cost: d.cost ?? null, eggs: null, semId: d.id, mode: "Semen" };
  }
  if (id === "LAFER_S" || id === "GEN_S") {
    const src = id === "LAFER_S" ? SPERM.LAFER : SPERM.GENEVITY, o = src.origins[S.spOrigin[id]] || src.origins[0], q = Math.max(1, S.spQty[id] || 1);
    const co = id === "LAFER_S" ? "LAFER" : "GENEVITY";
    return { co, tipo: "semen", estado: "congelado", label: `${co} · Semen congelado · ${o.o} × ${q} vial${q > 1 ? "es" : ""}`, p: o.p * q, cost: null, eggs: null, ship: o.ship || 0 };
  }
}
function addLines() {
  const ln = currentLine();
  if (!ln) return false;
  if (ln.semId) {
    const d = SEM.donors.find(x => x.id === ln.semId);
    if (semLeft(d) <= 0) { toast(`El perfil ${d.id} ya está vendido`); return false }
    if (S.lines.some(l => l.semId === d.id)) { toast(`El perfil ${d.id} ya está en la cotización`); return false }
  }
  if (ln.donor != null) {
    const d = DATA.OVO.donors.find(x => x.code === ln.donor), free = leftOf(d) - inCart(d.code);
    if (free < ln.eggs) { toast(free <= 0 ? `Donante #${d.code} sin óvulos disponibles` : `Donante #${d.code}: solo quedan ${free} óvulos disponibles`); return false }
  }
  S.lines.push(ln);
  if (ln.ship && !S.lines.some(l => l.isShip && l.co === ln.co))
    S.lines.push({ co: ln.co, tipo: "semen", estado: "", label: `${ln.co} · Traslado de muestra`, p: ln.ship, cost: null, eggs: null, isShip: true });
  calc(); renderLines(); return true;
}

/* ---------- Totales ---------- */
function build(lines = S.lines) {
  const disc = Math.min(30, Math.max(0, +$("disc").value || 0)) / 100;
  const gross = lines.reduce((s, l) => s + l.p, 0), dAmt = gross * disc, total = gross - dAmt;
  const eggLines = lines.filter(l => l.tipo === "ovulos");
  const eggs = eggLines.some(l => l.eggs == null) ? null : eggLines.reduce((s, l) => s + l.eggs, 0) || null;
  const eggNet = eggLines.reduce((s, l) => s + l.p, 0) * (1 - disc);
  const eggPer = eggs ? eggNet / eggs : null;
  const costed = lines.filter(l => l.cost != null);
  let cost = null, profit = null, margin = null;
  if (costed.length) {
    const rev = costed.reduce((s, l) => s + l.p, 0) * (1 - disc) / IVA;
    cost = costed.reduce((s, l) => s + l.cost, 0); profit = rev - cost; margin = profit / rev;
  }
  const cos = [...new Set(lines.map(l => l.co))];
  return { lines: lines.slice(), cos, disc, dAmt, gross, total, eggs, eggPer, cost, profit, margin, partial: costed.length && costed.length < lines.length };
}
function renderLines() {
  const r = build();
  $("lines").innerHTML = r.lines.length ? r.lines.map((l, i) => `<div class="line"><span>${l.label}</span><span class="amt num">${fmt(l.p)}<button class="rm" data-i="${i}" aria-label="Quitar">×</button></span></div>`).join("") +
    (r.disc ? `<div class="line"><span>Descuento ${(r.disc * 100).toFixed(1)}%</span><span class="num">−${fmt(r.dAmt)}</span></div>` : "")
    : `<div class="note">Aún no hay productos. Elige uno a la izquierda y toca «Agregar a la cotización».</div>`;
  $("lines").querySelectorAll(".rm").forEach(b => b.onclick = () => {
    const l = S.lines[+b.dataset.i];
    S.lines.splice(+b.dataset.i, 1);
    if (!l.isShip && l.ship && !S.lines.some(x => x.co === l.co && !x.isShip)) S.lines = S.lines.filter(x => !(x.isShip && x.co === l.co));
    calc(); renderLines();
  });
}
function calc() {
  const r = build();
  $("total").textContent = fmt(r.total);
  $("subtotal").textContent = `Sin IVA ${fmt(r.total / IVA)} · IVA ${fmt(r.total - r.total / IVA)}`;
  const hasEggs = r.lines.some(l => l.tipo === "ovulos");
  $("kEggs").textContent = !hasEggs ? "—" : r.eggs ?? "Según catálogo";
  $("kPer").textContent = r.eggPer ? fmt(r.eggPer) : "—";
  const int = $("internal").checked; $("intBox").hidden = !int;
  $("iCost").textContent = fmt(r.cost); $("iProfit").textContent = fmt(r.profit);
  $("iMargin").innerHTML = r.margin == null ? "N/D" : `<span class="pill ${r.margin < 0.25 ? "warn" : "ok"}">${pct(r.margin)}</span>`;
  $("iNote").textContent = (r.margin != null && r.margin < 0.25 ? "Margen bajo 25%: pide autorización antes de aplicar este descuento. " : "") +
    (r.partial ? "Margen calculado solo sobre productos con costo cargado." : "");
  $("addOpt").disabled = S.opts.length >= 4 || !r.lines.length;
  $("sellBtn").hidden = !CFG.ventasUrl || !S.lines.some(l => l.donor != null || l.semId);
  if ($("sellBtn").hidden) $("sellBox").hidden = true;
}

/* ---------- Comparación y mensajes ---------- */
function toast(t) { $("toast").textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => $("toast").textContent = "", 2500) }
function optText(r, i) {
  return `Opción ${i}: ${r.cos.join(" + ")}\n` + r.lines.map(x => `  • ${x.label}: ${fmt(x.p * (1 - r.disc))}`).join("\n") +
    `\n  Total con IVA: ${fmt(r.total)}` + (r.eggPer ? ` (${fmt(r.eggPer)} por óvulo)` : "");
}
function header() { const p = $("patient").value.trim(); return `Hola${p ? " " + p : ""}, te comparto la cotización de tu tratamiento con donación en Fertilidad Integral:\n\n` }
const footerMsg = "\n\nPrecios con IVA incluido, sujetos a disponibilidad del banco. Para apartar la opción elegida el pago se realiza antes de la reserva con el proveedor.";
function renderOpts() {
  const o = S.opts;
  if (!o.length) { $("cmp").innerHTML = `<div class="empty">Aún no hay opciones. Arma una cotización y toca «Agregar a comparación».</div>`; $("msg").value = ""; return }
  const pers = o.map(x => x.eggPer).filter(Boolean), best = pers.length > 1 ? Math.min(...pers) : null;
  $("cmp").innerHTML = o.map((r, i) => {
    const est = [...new Set(r.lines.map(l => l.estado).filter(Boolean))];
    return `<div class="opt ${best && r.eggPer === best ? "best" : ""}">
      <button class="x" data-i="${i}" aria-label="Quitar opción">×</button>
      <div class="eyebrow">Opción ${i + 1} · ${est.join(" / ")}</div><h3>${r.cos.join(" + ")}</h3>
      <div class="note">${r.lines.map(x => x.label).join("<br>")}</div>
      <div class="tt">${fmt(r.total)}</div>
      <div class="note num">${r.eggs ? r.eggs + " óvulos · " + fmt(r.eggPer) + "/óvulo" : r.lines.some(l => l.tipo === "ovulos") ? "Óvulos según catálogo" : "Solo semen"}</div>
      ${best && r.eggPer === best ? '<span class="pill ok" style="align-self:flex-start">Mejor precio por óvulo</span>' : ""}
      ${$("internal").checked && r.margin != null ? `<span class="note">Margen: ${pct(r.margin)}</span>` : ""}
    </div>`;
  }).join("");
  $("cmp").querySelectorAll(".x").forEach(b => b.onclick = () => { S.opts.splice(+b.dataset.i, 1); renderOpts(); calc() });
  $("msg").value = header() + o.map((r, i) => optText(r, i + 1)).join("\n\n") + footerMsg;
}
async function copy(t, ta) {
  try { await navigator.clipboard.writeText(t); toast("Mensaje copiado") }
  catch (e) { const el = ta || $("msg"); if (!ta) el.value = t; el.focus(); el.select(); toast("Selecciona y copia con Ctrl/Cmd + C") }
}

/* ---------- Buscador por presupuesto (óvulos) ---------- */
function finder() {
  const B = +$("budget").value || 0, m = +$("minEggs").value || 0, t = S.fEstado, rows = [];
  DATA.OCPC.cats.forEach((c, i) => { const q = Math.max(m, 1); rows.push({ bank: "OCP", est: ["congelado"], opt: `${c.c} × ${q}`, eggs: q, total: c.p * q, av: "Confirmar con OCP", set: () => { S.prod = "OCP_C"; S.ocpcCat = i; S.ocpcQty = q } }) });
  DATA.OCPF.cats.forEach((c, i) => rows.push({ bank: "OCP", est: ["fresco"], opt: `${c.c} · 1 paquete`, eggs: null, total: c.p, av: "Confirmar con OCP", set: () => { S.prod = "OCP_F"; S.ocpfCat = i; S.ocpfQty = 1 } }));
  DATA.OVO.donors.forEach(d => {
    const set = (mode, q) => () => { S.prod = "OVO_O"; S.donor = d.code; S.ovoMode = mode; if (q) S.ovoQty = q; if (t) S.ovoEstado = t };
    const L = leftOf(d);
    if (L >= d.eggs) rows.push({ bank: "OVODONORS", est: ["fresco", "congelado"], opt: `#${d.code} · lote`, eggs: d.eggs, total: d.pack, av: `Quedan ${L}`, set: set("lote") });
    if (d.av && m > 0 && m < d.eggs && L >= m) rows.push({ bank: "OVODONORS", est: ["fresco", "congelado"], opt: `#${d.code} · ${m} óvulos`, eggs: m, total: d.unit * m, av: `Quedan ${L}`, set: set("unit", m) });
  });
  const f = rows.filter(r => r.total <= B && (!t || r.est.includes(t)) && (r.eggs == null || r.eggs >= m))
    .sort((a, b) => (a.eggs ? a.total / a.eggs : Infinity) - (b.eggs ? b.total / b.eggs : Infinity) || a.total - b.total);
  $("finder").innerHTML = f.length ? f.map((r, i) => `<tr data-i="${i}"><td>${r.bank}</td><td>${r.opt}</td><td class="r num">${r.eggs ?? "—"}</td><td class="r num">${fmt(r.total)}</td><td class="r num">${r.eggs ? fmt(r.total / r.eggs) : "—"}</td><td>${r.est.map(e => `<span class="pill ${e}">${cap(e)}</span>`).join(" ")}</td><td><span class="pill ${r.av.startsWith("Confirmar") || r.av === "Lote completo" ? "" : "ok"}">${r.av}</span></td><td><span class="pill">Cotizar</span></td></tr>`).join("")
    : `<tr><td colspan="8" class="note" style="white-space:normal">Ninguna opción cabe en ese presupuesto con ese mínimo de óvulos. Baja el mínimo o revisa la modalidad por óvulo de Ovodonors.</td></tr>`;
  $("finder").querySelectorAll("tr[data-i]").forEach(tr => tr.onclick = () => {
    f[+tr.dataset.i].set();
    if (S.fTipo === "semen") { S.fTipo = ""; $("fTipo").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === "")) }
    renderCompanies(); renderCfg();
    $("cfg").scrollIntoView({ behavior: "smooth", block: "start" }); toast("Opción cargada: revisa y toca «Agregar a la cotización»");
  });
}

/* ---------- Eventos ---------- */
bindSeg("fTipo", "fTipo"); bindSeg("fEstado", "fEstado");
["disc", "patient"].forEach(id => $(id).oninput = () => { calc(); renderLines(); renderOpts() });
$("internal").onchange = () => { try { localStorage.setItem("fi_cot_int", $("internal").checked) } catch (e) {} calc(); renderOpts() };
$("addOpt").onclick = () => { if (S.opts.length < 4 && S.lines.length) { S.opts.push(build()); S.lines = []; renderLines(); renderOpts(); calc(); toast(`Opción ${S.opts.length} guardada. Arma la siguiente.`) } };
$("clearOpts").onclick = () => { S.opts = []; renderOpts(); calc() };
$("copyAll").onclick = () => { if (S.opts.length) copy($("msg").value, $("msg")); else toast("Agrega al menos una opción") };
$("copyOne").onclick = () => { if (S.lines.length) copy(header() + optText(build(), 1) + footerMsg); else toast("Agrega al menos un producto") };
["budget", "minEggs"].forEach(id => $(id).oninput = finder);
$("links").innerHTML = [["OCP Fresco", DATA.OCPF.link], ["OCP Congelado", DATA.OCPC.link], ["Ovodonors", DATA.OVO.link], ["LAFER", SPERM.LAFER.link], ["Genevity", SPERM.GENEVITY.link]]
  .map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join("");
if (!META.costos) { $("internal").checked = false; $("internal").closest("label").hidden = true }
$("src").innerHTML = `Fuente: ${META.fuente} · ${META.actualizaciones} · Generado ${META.generado}.`;

try { $("seller").value = localStorage.getItem("fi_seller") || "" } catch (e) {}
$("seller").oninput = () => { try { localStorage.setItem("fi_seller", $("seller").value.trim()) } catch (e) {} };
$("sellBtn").onclick = () => {
  const items = S.lines.filter(l => l.donor != null || l.semId);
  $("sellTxt").innerHTML = items.map(l => `• ${esc(l.label)}`).join("<br>") +
    `<br><br>Paciente: <b>${esc($("patient").value.trim() || "sin referencia")}</b> · Ejecutiva: <b>${esc($("seller").value.trim() || "sin nombre")}</b>` +
    `<br>Confirma que el pago ya se recibió: al apartar, estos productos dejan de aparecer disponibles para todas.`;
  $("sellBox").hidden = false; $("sellBtn").hidden = true;
};
$("sellNo").onclick = () => { $("sellBox").hidden = true; calc() };
$("sellOk").onclick = async () => {
  const seller = $("seller").value.trim();
  if (!seller) { toast("Escribe tu nombre en «Ejecutiva» antes de registrar la venta"); $("seller").focus(); return }
  const items = S.lines.filter(l => l.donor != null || l.semId).map(l => {
    if (l.semId) return { donante: "S-" + l.semId, cantidad: 1, modalidad: "Semen", estado: l.estado, stock: 1 };
    const d = DATA.OVO.donors.find(x => x.code === l.donor);
    return { donante: l.donor, cantidad: l.eggs, modalidad: l.mode, estado: l.estado, stock: stockOf(d) };
  });
  $("sellOk").disabled = true;
  const j = await postInv({ action: "vender", items, paciente: $("patient").value.trim(), ejecutiva: seller });
  $("sellOk").disabled = false;
  if (j.ok) {
    S.lines = S.lines.filter(l => l.donor == null && !l.semId); $("sellBox").hidden = true;
    renderLines(); calc(); toast("Venta registrada: inventario actualizado para todas");
  } else toast(j.error || "No se pudo registrar la venta");
};
$("syncNow").onclick = () => loadInv();
setInterval(() => { if (!document.hidden) loadInv(true) }, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadInv(true) });

/* ---------- Estado inicial de ejemplo: dos opciones precargadas ---------- */
S.prod = "OVO_O"; S.donor = 739; S.ovoMode = "lote"; addLines();
S.prod = "LAFER_S"; addLines();
S.opts.push(build()); S.lines = [];
S.prod = "OVO_O"; S.donor = 424; S.ovoMode = "unit"; S.ovoQty = 6; addLines();
S.prod = "GEN_S"; addLines();
S.opts.push(build());
S.prod = "OVO_O"; S.donor = 739; S.ovoMode = "lote";
renderCompanies(); renderCfg(); renderLines(); calc(); renderOpts(); finder(); renderSync(); renderSales(); loadInv();
