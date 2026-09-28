const IVA=1.16;
const {DATA,SPERM,META}=window.FI_DATA;
const $=id=>document.getElementById(id);
const fmt=n=>n==null||isNaN(n)?"—":"$"+Math.round(n).toLocaleString("es-MX");
const pct=n=>n==null||isNaN(n)?"N/D":(n*100).toFixed(1)+"%";
const S={bank:"OVO",ocpfCat:0,ocpfQty:1,ocpcCat:0,ocpcQty:6,donor:739,ovoMode:"lote",ovoQty:6,sort:"unit",opts:[]};
try{const s=JSON.parse(localStorage.getItem("fi_cot_int")||"null");if(s!=null)$("internal").checked=s}catch(e){}

function renderBanks(){
  $("banks").innerHTML=Object.entries(DATA).map(([k,b])=>`<button class="bank" data-k="${k}" aria-pressed="${S.bank===k}"><b>${b.short}</b><span>${b.type==="fresco"?"Fresco":"Congelado"} · ${b.desc}</span></button>`).join("");
  $("banks").querySelectorAll(".bank").forEach(el=>el.onclick=()=>{S.bank=el.dataset.k;renderBanks();renderEgg();calc()});
}
function catSelect(id,cats,sel,withCost){
  return `<select id="${id}">${cats.map((c,i)=>`<option value="${i}" ${i==sel?"selected":""}>${c.c} — ${fmt(c.p)}</option>`).join("")}</select>`;
}
function renderEgg(){
  const b=S.bank,el=$("eggCfg");
  let h=`<div class="step-h"><span class="step-n">2</span><h2>${DATA[b].name}</h2></div>`;
  if(b==="OCPF"){
    h+=`<div class="row"><div class="field"><label class="l" for="ocpfCat">Categoría</label>${catSelect("ocpfCat",DATA.OCPF.cats,S.ocpfCat)}</div>
    <div class="field" style="flex:0 1 120px"><label class="l" for="ocpfQty">Paquetes</label><input type="number" id="ocpfQty" min="1" max="3" value="${S.ocpfQty}"></div></div>
    <div class="note">Precio por paquete de óvulos, IVA incluido. El número de óvulos por paquete depende de la categoría: confírmalo en el catálogo.</div>`;
  }else if(b==="OCPC"){
    h+=`<div class="row"><div class="field"><label class="l" for="ocpcCat">Categoría</label>${catSelect("ocpcCat",DATA.OCPC.cats,S.ocpcCat)}</div>
    <div class="field" style="flex:0 1 120px"><label class="l" for="ocpcQty">Unidades</label><input type="number" id="ocpcQty" min="1" max="20" value="${S.ocpcQty}"></div></div>
    <div class="note">Precio unitario con IVA. Confirma con OCP si la unidad es óvulo individual o vial.</div>`;
  }else{
    const d=DATA.OVO.donors.slice().sort((a,c)=>S.sort==="unit"?a.unit-c.unit:S.sort==="pack"?a.pack-c.pack:S.sort==="eggs"?c.eggs-a.eggs:a.code-c.code);
    h+=`<div class="row" style="align-items:center;justify-content:space-between">
      <div class="seg" role="group" aria-label="Modalidad"><button data-m="lote" aria-pressed="${S.ovoMode==="lote"}">Lote completo</button><button data-m="unit" aria-pressed="${S.ovoMode==="unit"}">Por óvulo</button></div>
      <div class="field" style="flex:0 1 130px" ${S.ovoMode==="lote"?"hidden":""}><label class="l" for="ovoQty">Óvulos</label><input type="number" id="ovoQty" min="1" max="15" value="${S.ovoQty}"></div>
    </div>
    <div class="note">Toca una donante para seleccionarla. Ordena tocando el encabezado.</div>
    <div class="tbl-wrap"><table><thead><tr>
      <th data-s="code">Donante</th><th class="r" data-s="eggs">Óvulos</th><th class="r" data-s="pack">Lote c/IVA</th><th class="r" data-s="unit">Unit. c/IVA</th><th>Disponibilidad</th>
    </tr></thead><tbody>${d.map(x=>`<tr data-c="${x.code}" class="${x.code===S.donor?"sel":""}"><td class="num">#${x.code}</td><td class="r num">${x.eggs}</td><td class="r num">${fmt(x.pack)}</td><td class="r num">${fmt(x.unit)}</td><td>${x.av?`<span class="pill ok">${x.av}</span>`:`<span class="pill">Lote completo</span>`}</td></tr>`).join("")}</tbody></table></div>`;
  }
  el.innerHTML=h;
  const on=(id,k,num=true)=>{const i=$(id);if(i)i.oninput=()=>{S[k]=num?+i.value:i.value;calc()}};
  on("ocpfCat","ocpfCat");on("ocpfQty","ocpfQty");on("ocpcCat","ocpcCat");on("ocpcQty","ocpcQty");on("ovoQty","ovoQty");
  el.querySelectorAll(".seg button").forEach(x=>x.onclick=()=>{S.ovoMode=x.dataset.m;renderEgg();calc()});
  el.querySelectorAll("tbody tr").forEach(x=>x.onclick=()=>{S.donor=+x.dataset.c;renderEgg();calc()});
  el.querySelectorAll("th[data-s]").forEach(x=>x.onclick=()=>{S.sort=x.dataset.s;renderEgg()});
}
function renderSperm(){
  const k=$("spBank").value,o=$("spOrigin"),q=$("spQty");
  o.disabled=q.disabled=!k;
  o.innerHTML=k?SPERM[k].origins.map((x,i)=>`<option value="${i}">${x.o} — ${fmt(x.p)}/vial</option>`).join(""):"";
  spNote();
}
function spNote(){
  const k=$("spBank").value;
  if(!k){$("spNote").textContent="";return}
  const x=SPERM[k].origins[+$("spOrigin").value||0];
  $("spNote").textContent=[x.ship?`Traslado +${fmt(x.ship)} (una vez por envío)`:"",x.t].filter(Boolean).join(" · ");
}

function build(){
  const b=S.bank,items=[];let eggs=null,note="";
  if(b==="OCPF"){const c=DATA.OCPF.cats[S.ocpfCat],q=Math.max(1,S.ocpfQty||1);
    items.push({label:`OCP Fresco · ${c.c} × ${q} paquete${q>1?"s":""}`,p:c.p*q,cost:null});note="OCP Fresco no tiene costo cargado en el directorio.";}
  else if(b==="OCPC"){const c=DATA.OCPC.cats[S.ocpcCat],q=Math.max(1,S.ocpcQty||1);
    items.push({label:`OCP Congelado · ${c.c} × ${q}`,p:c.p*q,cost:c.cost!=null?c.cost*q:null});eggs=q;}
  else{const d=DATA.OVO.donors.find(x=>x.code===S.donor);
    if(S.ovoMode==="lote"){items.push({label:`Ovodonors · Donante #${d.code} · lote ${d.eggs} óvulos`,p:d.pack,cost:d.cost??null});eggs=d.eggs;}
    else{const q=Math.max(1,Math.min(d.eggs,S.ovoQty||1));items.push({label:`Ovodonors · Donante #${d.code} · ${q} óvulos`,p:d.unit*q,cost:d.cost!=null?d.cost/d.eggs*q:null});eggs=q;}
  }
  const sk=$("spBank").value;
  if(sk){const x=SPERM[sk].origins[+$("spOrigin").value||0],q=Math.max(1,+$("spQty").value||1);
    items.push({label:`${SPERM[sk].name} · ${x.o} × ${q} vial${q>1?"es":""}`,p:x.p*q,cost:null});
    if(x.ship)items.push({label:"Traslado de muestra",p:x.ship,cost:null});
    note=(note?note+" ":"")+"Semen y traslado sin costo cargado: margen calculado solo sobre óvulos.";}
  const disc=Math.min(30,Math.max(0,+$("disc").value||0))/100;
  const gross=items.reduce((s,i)=>s+i.p,0),dAmt=gross*disc,total=gross-dAmt;
  const egg=items[0],eggNet=egg.p*(1-disc);
  const eggPer=eggs?eggNet/eggs:null;
  let cost=null,profit=null,margin=null;
  if(egg.cost!=null){const sinIva=eggNet/IVA;cost=egg.cost;profit=sinIva-cost;margin=profit/sinIva;}
  return {bank:DATA[b].short,type:DATA[b].type,items,disc,dAmt,gross,total,eggs,eggPer,cost,profit,margin,note};
}
function calc(){
  const r=build();
  $("lines").innerHTML=r.items.map(i=>`<div class="line"><span>${i.label}</span><span class="num">${fmt(i.p)}</span></div>`).join("")+
    (r.disc?`<div class="line"><span>Descuento ${(r.disc*100).toFixed(1)}%</span><span class="num">−${fmt(r.dAmt)}</span></div>`:"");
  $("total").textContent=fmt(r.total);
  $("subtotal").textContent=`Sin IVA ${fmt(r.total/IVA)} · IVA ${fmt(r.total-r.total/IVA)}`;
  $("kEggs").textContent=r.eggs??"Según catálogo";
  $("kPer").textContent=r.eggPer?fmt(r.eggPer):"—";
  const int=$("internal").checked;$("intBox").hidden=!int;
  $("iCost").textContent=fmt(r.cost);$("iProfit").textContent=fmt(r.profit);
  $("iMargin").innerHTML=r.margin==null?"N/D":`<span class="pill ${r.margin<0.25?"warn":"ok"}">${pct(r.margin)}</span>`;
  $("iNote").textContent=(r.margin!=null&&r.margin<0.25?"Margen bajo 25%: pide autorización antes de aplicar este descuento. ":"")+r.note;
  $("addOpt").disabled=S.opts.length>=4;
  S.cur=r;
}
function toast(t){$("toast").textContent=t;clearTimeout(toast.t);toast.t=setTimeout(()=>$("toast").textContent="",2500)}
function optText(r,i){
  return `Opción ${i}: ${r.bank} (${r.type})\n`+r.items.map(x=>`  • ${x.label}: ${fmt(x.p*(1-r.disc))}`).join("\n")+
   `\n  Total con IVA: ${fmt(r.total)}`+(r.eggPer?` (${fmt(r.eggPer)} por óvulo)`:"");
}
function header(){const p=$("patient").value.trim();return `Hola${p?" "+p:""}, te comparto la cotización de tu tratamiento con donación en Fertilidad Integral:\n\n`}
const footerMsg="\n\nPrecios con IVA incluido, sujetos a disponibilidad del banco. Para apartar la opción elegida el pago se realiza antes de la reserva con el proveedor.";
function renderOpts(){
  const o=S.opts;
  if(!o.length){$("cmp").innerHTML=`<div class="empty">Aún no hay opciones. Configura una cotización y toca «Agregar a comparación».</div>`;$("msg").value="";return}
  const pers=o.map(x=>x.eggPer).filter(Boolean),best=pers.length>1?Math.min(...pers):null;
  $("cmp").innerHTML=o.map((r,i)=>`<div class="opt ${best&&r.eggPer===best?"best":""}">
    <button class="x" data-i="${i}" aria-label="Quitar opción">×</button>
    <div class="eyebrow">Opción ${i+1} · ${r.type}</div><h3>${r.bank}</h3>
    <div class="note">${r.items.map(x=>x.label).join("<br>")}</div>
    <div class="tt">${fmt(r.total)}</div>
    <div class="note num">${r.eggs?r.eggs+" óvulos · "+fmt(r.eggPer)+"/óvulo":"Óvulos según catálogo"}</div>
    ${best&&r.eggPer===best?'<span class="pill ok" style="align-self:flex-start">Mejor precio por óvulo</span>':""}
    ${$("internal").checked&&r.margin!=null?`<span class="note">Margen: ${pct(r.margin)}</span>`:""}
  </div>`).join("");
  $("cmp").querySelectorAll(".x").forEach(b=>b.onclick=()=>{S.opts.splice(+b.dataset.i,1);renderOpts();calc()});
  $("msg").value=header()+o.map((r,i)=>optText(r,i+1)).join("\n\n")+footerMsg;
}
async function copy(t,ta){
  try{await navigator.clipboard.writeText(t);toast("Mensaje copiado")}
  catch(e){const el=ta||$("msg");if(!ta)el.value=t;el.focus();el.select();toast("Selecciona y copia con Ctrl/Cmd + C")}
}

function finder(){
  const B=+$("budget").value||0,m=+$("minEggs").value||0,t=$("fType").value,rows=[];
  DATA.OCPC.cats.forEach((c,i)=>{const q=Math.max(m,1);rows.push({bank:"OCP Congelado",type:"congelado",opt:`${c.c} × ${q}`,eggs:q,total:c.p*q,av:"Confirmar con OCP",set:()=>{S.bank="OCPC";S.ocpcCat=i;S.ocpcQty=q}})});
  DATA.OCPF.cats.forEach((c,i)=>rows.push({bank:"OCP Fresco",type:"fresco",opt:`${c.c} · 1 paquete`,eggs:null,total:c.p,av:"Confirmar con OCP",set:()=>{S.bank="OCPF";S.ocpfCat=i;S.ocpfQty=1}}));
  DATA.OVO.donors.forEach(d=>{
    rows.push({bank:"Ovodonors",type:"congelado",opt:`#${d.code} · lote`,eggs:d.eggs,total:d.pack,av:d.av||"Lote completo",set:()=>{S.bank="OVO";S.donor=d.code;S.ovoMode="lote"}});
    if(d.av&&m>0&&m<d.eggs)rows.push({bank:"Ovodonors",type:"congelado",opt:`#${d.code} · ${m} óvulos`,eggs:m,total:d.unit*m,av:d.av,set:()=>{S.bank="OVO";S.donor=d.code;S.ovoMode="unit";S.ovoQty=m}});
  });
  const f=rows.filter(r=>r.total<=B&&(!t||r.type===t)&&(r.eggs==null||r.eggs>=m))
    .sort((a,b)=>(a.eggs?a.total/a.eggs:Infinity)-(b.eggs?b.total/b.eggs:Infinity)||a.total-b.total);
  $("finder").innerHTML=f.length?f.map((r,i)=>`<tr data-i="${i}"><td>${r.bank}</td><td>${r.opt}</td><td class="r num">${r.eggs??"—"}</td><td class="r num">${fmt(r.total)}</td><td class="r num">${r.eggs?fmt(r.total/r.eggs):"—"}</td><td><span class="pill ${r.av.startsWith("Confirmar")||r.av==="Lote completo"?"":"ok"}">${r.av}</span></td><td><span class="pill">Cotizar</span></td></tr>`).join("")
    :`<tr><td colspan="7" class="note" style="white-space:normal">Ninguna opción cabe en ese presupuesto con ese mínimo de óvulos. Baja el mínimo o revisa la modalidad por óvulo de Ovodonors.</td></tr>`;
  $("finder").querySelectorAll("tr[data-i]").forEach(tr=>tr.onclick=()=>{f[+tr.dataset.i].set();renderBanks();renderEgg();calc();window.scrollTo({top:0,behavior:"smooth"});toast("Opción cargada en el cotizador")});
}

$("spBank").onchange=()=>{renderSperm();calc()};
$("spOrigin").onchange=()=>{spNote();calc()};
["spQty","disc","patient"].forEach(id=>$(id).oninput=()=>{calc();renderOpts()});
$("internal").onchange=()=>{try{localStorage.setItem("fi_cot_int",$("internal").checked)}catch(e){};calc();renderOpts()};
$("addOpt").onclick=()=>{if(S.opts.length<4){S.opts.push(build());renderOpts();calc();toast(`Opción ${S.opts.length} agregada`)}};
$("clearOpts").onclick=()=>{S.opts=[];renderOpts();calc()};
$("copyAll").onclick=()=>{if(S.opts.length)copy($("msg").value,$("msg"));else toast("Agrega al menos una opción")};
$("copyOne").onclick=()=>copy(header()+optText(build(),1)+footerMsg);
["budget","minEggs","fType"].forEach(id=>$(id).oninput=finder);
$("links").innerHTML=[["OCP Fresco",DATA.OCPF.link],["OCP Congelado",DATA.OCPC.link],["Ovodonors",DATA.OVO.link],["LAFER",SPERM.LAFER.link],["Genevity",SPERM.GENEVITY.link]].map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join("");

if(!META.costos){$("internal").checked=false;$("internal").closest("label").hidden=true}
$("src").innerHTML=`Fuente: ${META.fuente} · ${META.actualizaciones} · Generado ${META.generado}.`;
// Estado inicial de ejemplo: dos opciones precargadas
renderBanks();renderEgg();renderSperm();calc();
S.opts.push(build());
S.bank="OVO";S.donor=424;S.ovoMode="unit";S.ovoQty=6;renderBanks();renderEgg();calc();S.opts.push(build());
S.bank="OVO";S.donor=739;S.ovoMode="lote";renderBanks();renderEgg();calc();renderOpts();finder();
