const IVA = 1.16;
const { DATA, SPERM, META } = window.FI_DATA;
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
  { id: "OVO_S", co: "OVODONORS", tipo: "semen", estados: ["fresco", "congelado"], name: "Semen", desc: "Precio a solicitar con Ana",
    from: null, link: DATA.OVO.link, noPrice: true },
];
const P = id => PRODUCTS.find(p => p.id === id);

/* ---------- Estado ---------- */
const S = {
  fTipo: "", fEstado: "", prod: "OVO_O",
  ocpfCat: 0, ocpfQty: 1, ocpcCat: 0, ocpcQty: 6,
  donor: 739, ovoMode: "lote", ovoQty: 6, ovoEstado: "congelado", sort: "unit",
  spOrigin: { LAFER_S: 2, GEN_S: 2 }, spQty: { LAFER_S: 1, GEN_S: 1 },
  lines: [], opts: []
};
try { const s = JSON.parse(localStorage.getItem("fi_cot_int") || "null"); if (s != null) $("internal").checked = s } catch (e) {}

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
    const d = DATA.OVO.donors.slice().sort((a, c) => S.sort === "unit" ? a.unit - c.unit : S.sort === "pack" ? a.pack - c.pack : S.sort === "eggs" ? c.eggs - a.eggs : a.code - c.code);
    const estados = S.fEstado ? [S.fEstado] : ["fresco", "congelado"];
    h += `<div class="row" style="align-items:flex-end;justify-content:space-between">
        <div class="fgroup"><span class="l">Modalidad</span><div class="seg" role="group" aria-label="Modalidad" id="ovoMode"><button data-m="lote" aria-pressed="${S.ovoMode === "lote"}">Lote completo</button><button data-m="unit" aria-pressed="${S.ovoMode === "unit"}">Por óvulo</button></div></div>
        <div class="fgroup"><span class="l">Estado</span><div class="seg" role="group" aria-label="Estado Ovodonors" id="ovoEst">${estados.map(e => `<button data-e="${e}" aria-pressed="${S.ovoEstado === e}">${cap(e)}</button>`).join("")}</div></div>
        <div class="field" style="flex:0 1 110px" ${S.ovoMode === "lote" ? "hidden" : ""}><label class="l" for="ovoQty">Óvulos</label><input type="number" id="ovoQty" min="1" max="15" value="${S.ovoQty}"></div>
      </div>
      <div class="note">Toca una donante para seleccionarla. Ordena tocando el encabezado. Confirma con Ana si la donante está disponible en fresco o congelado.</div>
      <div class="tbl-wrap"><table><thead><tr>
        <th data-s="code">Donante</th><th class="r" data-s="eggs">Óvulos</th><th class="r" data-s="pack">Lote c/IVA</th><th class="r" data-s="unit">Unit. c/IVA</th><th>Disponibilidad</th>
      </tr></thead><tbody>${d.map(x => `<tr data-c="${x.code}" class="${x.code === S.donor ? "sel" : ""}"><td class="num">#${x.code}</td><td class="r num">${x.eggs}</td><td class="r num">${fmt(x.pack)}</td><td class="r num">${fmt(x.unit)}</td><td>${x.av ? `<span class="pill ok">${x.av}</span>` : `<span class="pill">Lote completo</span>`}</td></tr>`).join("")}</tbody></table></div>`;
  }
  const ln = currentLine();
  h += `<div class="addbar"><div><div class="note">${ln.label}</div><div class="num">${fmt(ln.p)}</div></div>
        <button class="btn" id="addLine">Agregar a la cotización</button></div>`;
  el.innerHTML = h;

  const on = (id, fn) => { const i = $(id); if (i) i.oninput = () => { fn(+i.value); refreshAddbar() } };
  on("ocpfCat", v => S.ocpfCat = v); on("ocpfQty", v => S.ocpfQty = v);
  on("ocpcCat", v => S.ocpcCat = v); on("ocpcQty", v => S.ocpcQty = v);
  on("ovoQty", v => S.ovoQty = v);
  on("spQty", v => S.spQty[S.prod] = v);
  const so = $("spOrigin"); if (so) so.onchange = () => { S.spOrigin[S.prod] = +so.value; renderCfg() };
  el.querySelectorAll("#ovoMode button").forEach(x => x.onclick = () => { S.ovoMode = x.dataset.m; renderCfg() });
  el.querySelectorAll("#ovoEst button").forEach(x => x.onclick = () => { S.ovoEstado = x.dataset.e; renderCfg() });
  el.querySelectorAll("tbody tr").forEach(x => x.onclick = () => { S.donor = +x.dataset.c; renderCfg() });
  el.querySelectorAll("th[data-s]").forEach(x => x.onclick = () => { S.sort = x.dataset.s; renderCfg() });
  $("addLine").onclick = () => { addLines(); toast("Agregado a la cotización") };
}
function refreshAddbar() {
  const ln = currentLine(), bar = document.querySelector(".addbar");
  if (bar) { bar.querySelector(".note").textContent = ln.label; bar.querySelector(".num").textContent = fmt(ln.p) }
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
    if (S.ovoMode === "lote") return { co: "OVODONORS", tipo: "ovulos", estado: e, label: `Ovodonors · Óvulos ${e}s · Donante #${d.code} · lote ${d.eggs}`, p: d.pack, cost: d.cost ?? null, eggs: d.eggs };
    const q = Math.max(1, Math.min(d.eggs, S.ovoQty || 1));
    return { co: "OVODONORS", tipo: "ovulos", estado: e, label: `Ovodonors · Óvulos ${e}s · Donante #${d.code} · ${q} óvulos`, p: d.unit * q, cost: d.cost != null ? d.cost / d.eggs * q : null, eggs: q };
  }
  if (id === "LAFER_S" || id === "GEN_S") {
    const src = id === "LAFER_S" ? SPERM.LAFER : SPERM.GENEVITY, o = src.origins[S.spOrigin[id]] || src.origins[0], q = Math.max(1, S.spQty[id] || 1);
    const co = id === "LAFER_S" ? "LAFER" : "GENEVITY";
    return { co, tipo: "semen", estado: "congelado", label: `${co} · Semen congelado · ${o.o} × ${q} vial${q > 1 ? "es" : ""}`, p: o.p * q, cost: null, eggs: null, ship: o.ship || 0 };
  }
}
function addLines() {
  const ln = currentLine();
  S.lines.push(ln);
  if (ln.ship && !S.lines.some(l => l.isShip && l.co === ln.co))
    S.lines.push({ co: ln.co, tipo: "semen", estado: "", label: `${ln.co} · Traslado de muestra`, p: ln.ship, cost: null, eggs: null, isShip: true });
  calc(); renderLines();
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
    rows.push({ bank: "OVODONORS", est: ["fresco", "congelado"], opt: `#${d.code} · lote`, eggs: d.eggs, total: d.pack, av: d.av || "Lote completo", set: set("lote") });
    if (d.av && m > 0 && m < d.eggs) rows.push({ bank: "OVODONORS", est: ["fresco", "congelado"], opt: `#${d.code} · ${m} óvulos`, eggs: m, total: d.unit * m, av: d.av, set: set("unit", m) });
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

/* ---------- Estado inicial de ejemplo: dos opciones precargadas ---------- */
S.prod = "OVO_O"; S.donor = 739; S.ovoMode = "lote"; addLines();
S.prod = "LAFER_S"; addLines();
S.opts.push(build()); S.lines = [];
S.prod = "OVO_O"; S.donor = 424; S.ovoMode = "unit"; S.ovoQty = 6; addLines();
S.prod = "GEN_S"; addLines();
S.opts.push(build());
S.prod = "OVO_O"; S.donor = 739; S.ovoMode = "lote";
renderCompanies(); renderCfg(); renderLines(); calc(); renderOpts(); finder();
