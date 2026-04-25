

const API = 'https://legacyinvest.app.n8n.cloud/webhook/legacy-invest-properties';
const PHOLDER = 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&h=500&fit=crop';
const DEFAULTS = {vac:0,mgmt:10,maint:0,down:25,rate:6.5,term:30,close:5};
const EMAILS = ['Taylor@legacyinvest.net','Documents@legacyinvest.net'];
const f$ = n => '$'+Math.round(n).toLocaleString();
const fp = n => n.toFixed(2)+'%';
const OL = {vacant:'Vacant',rented:'Rented',construction:'Under Const.'};
const SL = {available:'Available','coming-soon':'Coming Soon',sold:'Sold'};
const SBG = {available:'#16a34a','coming-soon':'#d97706',sold:'#dc2626'};
function sbg(s){return SBG[s]||'#1a2f5e';}
let PROPS=[], SS={}, VIEW='grid';
let FF={pMin:'',pMax:'',beds:0,baths:0,sqMin:'',sqMax:'',yrMin:'',yrMax:'',status:'',occ:''};

// ── CALC ──
function calc(p,s){
  const g=s.rent*(1-s.vac/100), tm=p.taxes/12, im=p.ins;
  const ma=g*s.mgmt/100, xa=s.rent*s.maint/100;
  const noi=g-tm-im-ma-xa, ln=p.price*(1-s.down/100);
  const r=s.rate/100/12, n=s.term*12;
  const mo=r>0?ln*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):ln/n;
  const net=noi-mo, da=p.price*s.down/100, ca=p.price*s.close/100, oop=da+ca;
  const cap=p.price>0?(noi*12/p.price)*100:0, coc=oop>0?(net*12/oop)*100:0;
  const irr=Math.max(0,coc*1.75+cap*0.3);
  return {g,tm,im,ma,xa,noi,mo,net,ln,oop,cap,coc,irr,da,ca};
}
function iS(p){return {rent:p.rent,vac:DEFAULTS.vac,ins:p.ins,mgmt:DEFAULTS.mgmt,maint:DEFAULTS.maint,down:DEFAULTS.down,rate:DEFAULTS.rate,term:DEFAULTS.term,close:p.close};}

// ── SLIDESHOW ──
function mkSS(id,photos){
  const el=document.getElementById(id); if(!el) return;
  if(!photos||!photos.length) photos=[PHOLDER];
  el.className=(el.className||'').replace('slideshow','')+' slideshow';
  let h='';
  photos.forEach((src,i)=>{ h+=`<img src="${src}" class="${i===0?'on':''}" onerror="this.src='${PHOLDER}'" loading="lazy"/>`; });
  if(photos.length>1){
    h+='<button class="s-prev" onclick="event.stopPropagation();ssDir(this,-1)">&#8249;</button>';
    h+='<button class="s-next" onclick="event.stopPropagation();ssDir(this,1)">&#8250;</button>';
    h+='<div class="s-dots">';
    photos.forEach((_,i)=>{ h+=`<div class="s-dot${i===0?' on':''}" onclick="event.stopPropagation();ssDot(this,${i})"></div>`; });
    h+='</div>';
  }
  el.innerHTML=h; el.dataset.i='0'; el.dataset.t=photos.length;
  el.querySelectorAll('img').forEach(img=>{ img.onerror=()=>img.src=PHOLDER; });
}
function ssDir(btn,d){
  const el=btn.closest('.slideshow'); if(!el) return;
  const t=+el.dataset.t, i=(+el.dataset.i+d+t)%t;
  ssGo(el,i);
}
function ssDot(dot,i){ ssGo(dot.closest('.slideshow'),i); }
function ssGo(el,i){
  if(!el) return;
  el.dataset.i=i;
  el.querySelectorAll('img').forEach((img,j)=>img.className=j===i?'on':'');
  el.querySelectorAll('.s-dot').forEach((d,j)=>d.className='s-dot'+(j===i?' on':''));
}

// ── LOAD ──
async function loadProps(){
  // DUMMY START
  PROPS=[
    {id:'d1',price:145000,addr:'114 Powell Ave',city:'Saint Louis',state:'MO',zip:'63135',beds:3,baths:2,sqft:998,basement:'Full',yr:1961,status:'available',occ:'vacant',rent:1350,taxes:1674,annualIns:1450,ins:1450/12,close:5,photos:['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900&h=500&fit=crop']},
    {id:'d2',price:135000,addr:'12371 Pinta Dr',city:'Saint Louis',state:'MO',zip:'63138',beds:3,baths:1,sqft:1164,basement:'None',yr:1962,status:'coming-soon',occ:'vacant',rent:1350,taxes:1200,annualIns:1350,ins:1350/12,close:5,photos:['https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900&h=500&fit=crop']},
    {id:'d3',price:150000,addr:'2535 Center Ave',city:'Saint Louis',state:'MO',zip:'63136',beds:4,baths:1,sqft:1175,basement:'Slab',yr:1955,status:'sold',occ:'rented',rent:1450,taxes:1800,annualIns:1500,ins:1500/12,close:5,photos:['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&h=500&fit=crop']}
  ];
  render(); return; // DUMMY END — delete this line for live data
  try {
    const res=await fetch(API);
    if(!res.ok) throw new Error('API error '+res.status);
    const data=await res.json();
    PROPS=(data.value||[]).map(item=>{
      const f=item.fields||{}, p=parseFloat(f.Price1)||0;
      return {id:item.id,price:p,addr:f.Address||'',city:f.City||'',state:f.State||'',zip:f.Zip||'',
        beds:parseInt(f.Beds)||0,baths:parseFloat(f.Baths)||0,sqft:parseInt(f.SqFT)||0,
        basement:f.Basement||'None',yr:parseInt(f.YearBuilt)||0,status:f.Status||'available',
        occ:f.Occupancy||'vacant',rent:parseFloat(f.Rent)||0,taxes:parseFloat(f.Taxes)||0,
        annualIns:p*0.01,ins:p*0.01/12,close:DEFAULTS.close,
        photos:(item.photos&&item.photos.length)?item.photos:(f.PhotoUrl?[f.PhotoUrl]:[PHOLDER])};
    });
    render();
  } catch(e){
    document.getElementById('grid').innerHTML=`<div class="loading" style="color:#ef4444">Failed to load: ${e.message}</div>`;
  }
}

// ── FILTER PANEL ──
function openF(){document.getElementById('fp').classList.add('open');document.getElementById('fo').classList.add('open');}
function closeF(){document.getElementById('fp').classList.remove('open');document.getElementById('fo').classList.remove('open');}
function bbClick(btn,grp){
  document.querySelectorAll(`#bb_${grp} .bb-btn`).forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); FF[grp]=+btn.dataset.v; badge();
}
function stClick(btn,key,cls){
  document.querySelectorAll(`#st_${key} .st-btn`).forEach(b=>b.className='st-btn');
  btn.classList.add(cls); FF[key]=btn.dataset.v; badge();
}
function badge(){
  let n=0;
  FF.pMin=document.getElementById('fpMin').value; FF.pMax=document.getElementById('fpMax').value;
  FF.sqMin=document.getElementById('fsMin').value; FF.sqMax=document.getElementById('fsMax').value;
  FF.yrMin=document.getElementById('fyMin').value; FF.yrMax=document.getElementById('fyMax').value;
  if(FF.pMin||FF.pMax) n++; if(FF.beds>0) n++; if(FF.baths>0) n++;
  if(FF.sqMin||FF.sqMax) n++; if(FF.yrMin||FF.yrMax) n++;
  if(FF.status) n++; if(FF.occ) n++;
  const b=document.getElementById('fbadge'); b.style.display=n?'inline':'none'; b.textContent=n;
}
function clearF(){
  FF={pMin:'',pMax:'',beds:0,baths:0,sqMin:'',sqMax:'',yrMin:'',yrMax:'',status:'',occ:''};
  ['fpMin','fpMax','fsMin','fsMax','fyMin','fyMax'].forEach(id=>document.getElementById(id).value='');
  document.querySelectorAll('.bb-btn').forEach((b,i)=>b.classList.toggle('active',i===0||i===6));
  document.querySelectorAll('.st-btn').forEach((b,i)=>{b.className='st-btn';if(i===0||i===4)b.classList.add(i===0?'active-av':'active-oc');});
  // reset to "Any"
  document.querySelectorAll('#bb_beds .bb-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  document.querySelectorAll('#bb_baths .bb-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  document.querySelectorAll('#st_status .st-btn').forEach((b,i)=>b.classList.toggle('active-av',i===0));
  document.querySelectorAll('#st_occ .st-btn').forEach((b,i)=>b.classList.toggle('active-oc',i===0));
  badge(); render();
}

// ── VIEW ──
function setView(v){
  VIEW=v;
  ['grid','list','map'].forEach(x=>document.getElementById('vb_'+x).classList.toggle('active',x===v));
  render();
}

// ── RENDER ──
function render(){
  const q=document.getElementById('srch').value.toLowerCase();
  const so=document.getElementById('srt').value;
  let ps=PROPS.slice();
  if(q) ps=ps.filter(p=>(p.addr+' '+p.city+' '+p.zip).toLowerCase().includes(q));
  if(FF.pMin) ps=ps.filter(p=>p.price>=+FF.pMin);
  if(FF.pMax) ps=ps.filter(p=>p.price<=+FF.pMax);
  if(FF.beds>0) ps=ps.filter(p=>p.beds>=FF.beds);
  if(FF.baths>0) ps=ps.filter(p=>p.baths>=FF.baths);
  if(FF.sqMin) ps=ps.filter(p=>p.sqft>=+FF.sqMin);
  if(FF.sqMax) ps=ps.filter(p=>p.sqft<=+FF.sqMax);
  if(FF.yrMin) ps=ps.filter(p=>p.yr>=+FF.yrMin);
  if(FF.yrMax) ps=ps.filter(p=>p.yr<=+FF.yrMax);
  if(FF.status) ps=ps.filter(p=>p.status===FF.status);
  if(FF.occ) ps=ps.filter(p=>p.occ===FF.occ);
  ps.sort((a,b)=>{
    const ca=calc(a,iS(a)), cb=calc(b,iS(b));
    if(so==='pa') return a.price-b.price; if(so==='pd') return b.price-a.price;
    if(so==='rd') return b.rent-a.rent; if(so==='cd') return cb.cap-ca.cap;
    if(so==='fd') return cb.net-ca.net; return b.price-a.price;
  });
  document.getElementById('rc').innerHTML=`<strong>${ps.length}</strong> of <strong>${PROPS.length}</strong> properties`;
  const g=document.getElementById('grid');
  if(!ps.length){g.className='';g.innerHTML='<div class="loading">No properties match your filters.</div>';return;}
  if(VIEW==='grid') rGrid(ps,g);
  else if(VIEW==='list') rList(ps,g);
  else rMap(ps,g);
}
document.getElementById('srch').addEventListener('input',render);

function sq(p){return (p.basement&&p.basement!=='None'?p.basement+' + ':'')+p.sqft.toLocaleString()+' sf';}

// ── GRID ──
function rGrid(ps,g){
  g.className='grid-view';
  let h='';
  ps.forEach(p=>{
    const s=iS(p), c=calc(p,s), cf=c.net>=0?'#16a34a':'#ef4444';
    h+=`<div class="prop-card" onclick="openD(${JSON.stringify(p.id)})">`;
    h+=`<div class="card-img" id="gi_${p.id}"><img src="${p.photos[0]}" loading="lazy"/>`;
    h+=`<div class="s-ribbon" style="background:${sbg(p.status)}">${SL[p.status]||p.status}</div>`;
    h+=`<div class="o-ribbon">${OL[p.occ]||p.occ}</div></div>`;
    h+=`<div class="card-body"><div class="card-price">${f$(p.price)}</div>`;
    h+=`<div class="card-addr">${p.addr}, ${p.city}, ${p.state} ${p.zip}</div>`;
    h+=`<div class="card-specs"><span>${p.beds}bd</span><span style="color:#ccc">&middot;</span><span>${p.baths}ba</span><span style="color:#ccc">&middot;</span><span>${sq(p)}</span><span style="color:#ccc">&middot;</span><span>${p.yr}</span></div>`;
    h+=`<div class="card-mets">`;
    h+=`<div class="c-met"><div class="c-ml">CF/mo</div><div class="c-mv" style="color:${cf}">${f$(c.net)}</div></div>`;
    h+=`<div class="c-met"><div class="c-ml">Cap</div><div class="c-mv">${c.cap.toFixed(1)}%</div></div>`;
    h+=`<div class="c-met"><div class="c-ml">CoC</div><div class="c-mv">${c.coc.toFixed(1)}%</div></div>`;
    h+=`<div class="c-met"><div class="c-ml">Rent</div><div class="c-mv">${f$(p.rent)}</div></div>`;
    h+=`</div></div>`;
    h+=`<div class="card-foot">`;
    h+=`<button class="c-pbtn" onclick="event.stopPropagation();openP(${JSON.stringify(p.id)})">&#128202; Proforma</button>`;
    h+=`<button class="c-rbtn" onclick="event.stopPropagation();openR(${JSON.stringify(p.id)})">&#10003; Reserve</button>`;
    h+=`</div></div>`;
  });
  g.innerHTML=h;
  ps.forEach(p=>mkSS(`gi_${p.id}`,p.photos));
}

// ── LIST ──
function rList(ps,g){
  g.className='list-view';
  let h='';
  ps.forEach(p=>{
    const s=iS(p), c=calc(p,s), cf=c.net>=0?'#16a34a':'#ef4444';
    h+=`<div class="list-card" onclick="openD(${JSON.stringify(p.id)})">`;
    h+=`<div class="list-img" id="li_${p.id}"><img src="${p.photos[0]}" style="width:100%;height:100%;object-fit:cover;"/>`;
    h+=`<div class="s-ribbon" style="background:${sbg(p.status)};position:absolute;top:12px;left:0;z-index:2;">${SL[p.status]||p.status}</div></div>`;
    h+=`<div class="list-body"><div class="l-top">`;
    h+=`<div><div class="l-price">${f$(p.price)}</div><div class="l-addr">${p.addr}, ${p.city}, ${p.state} ${p.zip}</div></div>`;
    h+=`<span style="background:${sbg(p.status)};color:white;font-size:9px;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:uppercase;flex-shrink:0">${SL[p.status]||p.status}</span>`;
    h+=`</div>`;
    h+=`<div class="l-specs"><span>${p.beds}bd</span><span>&middot;</span><span>${p.baths}ba</span><span>&middot;</span><span>${sq(p)}</span><span>&middot;</span><span>Built ${p.yr}</span></div>`;
    h+=`<div class="l-mets">`;
    h+=`<div class="l-met"><div class="l-ml">Cash Flow</div><div class="l-mv" style="color:${cf}">${f$(c.net)}/mo</div></div>`;
    h+=`<div class="l-met"><div class="l-ml">Cap Rate</div><div class="l-mv">${c.cap.toFixed(2)}%</div></div>`;
    h+=`<div class="l-met"><div class="l-ml">CoC</div><div class="l-mv">${c.coc.toFixed(2)}%</div></div>`;
    h+=`<div class="l-met"><div class="l-ml">Rent/mo</div><div class="l-mv">${f$(p.rent)}</div></div>`;
    h+=`<div class="l-met"><div class="l-ml">Taxes/yr</div><div class="l-mv">${f$(p.taxes)}</div></div>`;
    h+=`</div>`;
    h+=`<div class="l-btns">`;
    h+=`<button class="l-pbtn" onclick="event.stopPropagation();openP(${JSON.stringify(p.id)})">&#128202; Proforma</button>`;
    h+=`<button class="l-rbtn" onclick="event.stopPropagation();openR(${JSON.stringify(p.id)})">&#10003; Reserve</button>`;
    h+=`</div></div></div>`;
  });
  g.innerHTML=h;
  ps.forEach(p=>mkSS(`li_${p.id}`,p.photos));
}

// ── MAP ──
function rMap(ps,g){
  g.className='map-view';
  const ctr=ps.length?encodeURIComponent(ps[0].addr+' '+ps[0].city+' '+ps[0].state):'Saint Louis, MO';
  let h=`<div class="map-container"><iframe src="https://maps.google.com/maps?q=${ctr}&output=embed&z=11" loading="lazy"></iframe></div>`;
  h+='<div class="map-list">';
  ps.forEach(p=>{
    const s=iS(p), c=calc(p,s), cf=c.net>=0?'#16a34a':'#ef4444';
    h+=`<div class="map-prop" onclick="openD(${JSON.stringify(p.id)})">`;
    h+=`<div class="map-prop-img"><img src="${p.photos[0]}" onerror="this.src='${PHOLDER}'"/></div>`;
    h+=`<div class="map-prop-info"><div class="mp-price">${f$(p.price)}</div>`;
    h+=`<div class="mp-addr">${p.addr}, ${p.city}</div>`;
    h+=`<div class="mp-stats"><span style="color:${cf}">${f$(c.net)}/mo</span><span>&middot;</span><span>${c.cap.toFixed(1)}% cap</span><span>&middot;</span><span style="color:${sbg(p.status)}">${SL[p.status]||p.status}</span></div>`;
    h+=`</div></div>`;
  });
  h+='</div>'; g.innerHTML=h;
}

// ── DETAIL ──
function openD(id){
  const p=PROPS.find(x=>x.id===id); if(!p) return;
  if(!SS[id]) SS[id]=iS(p);
  const s=SS[id], c=calc(p,s);
  const tgts=[
    {l:'Net Cash Flow',v:c.net,t:500,col:'#22c55e',fmt:v=>f$(v)+'/mo'},
    {l:'Cash on Cash',v:c.coc,t:10,col:'#3b82f6',fmt:v=>v.toFixed(1)+'%'},
    {l:'Cap Rate',v:c.cap,t:8,col:'#8b5cf6',fmt:v=>v.toFixed(1)+'%'},
    {l:'IRR',v:c.irr,t:15,col:'#c9a227',fmt:v=>v.toFixed(1)+'%'}
  ];
  const kbars=tgts.map(t=>`<div class="kpi-row"><div style="width:9px;height:9px;border-radius:50%;background:${t.col};flex-shrink:0"></div><span style="font-size:10px;color:#555;min-width:85px">${t.l}</span><div class="kpi-bw"><div class="kpi-bf" style="width:${Math.min(100,Math.round(t.v/t.t*100))}%;background:${t.col}"></div></div><span style="font-size:10px;font-weight:700;color:${t.col};min-width:45px;text-align:right">${t.fmt(t.v)}</span></div>`).join('');
  const ec=['#6366f1','#c9a227','#10b981','#3b82f6','#e879f9'];
  const exps=[['Mortgage',c.mo],['Taxes/mo',p.taxes/12],['Ins/mo',p.ins],['Mgmt',c.ma],['Maint',c.xa]];
  const tE=c.g-c.net||1;
  const ebars=exps.map(([l,v],i)=>`<div class="exp-row"><div class="exp-top"><span style="color:#555">${l}</span><span style="color:${ec[i]};font-weight:600">${f$(v)}</span></div><div class="exp-bg"><div class="exp-fill" style="width:${Math.round(Math.abs(v)/tE*100)}%;background:${ec[i]}"></div></div></div>`).join('');
  const irows=[['Gross Rent',f$(s.rent),'#111'],['Vacancy ('+s.vac+'%)','&#8722;'+f$(Math.round(s.rent*s.vac/100)),'#ef4444'],['Eff. Income',f$(c.g),'#22c55e'],['&#8722;Taxes/mo','&#8722;'+f$(Math.round(p.taxes/12)),'#888'],['&#8722;Ins/mo','&#8722;'+f$(Math.round(p.ins)),'#888'],['&#8722;Mgmt ('+s.mgmt+'%)','&#8722;'+f$(Math.round(c.ma)),'#888'],['&#8722;Maint ('+s.maint+'%)','&#8722;'+f$(Math.round(c.xa)),'#888'],['NOI',f$(c.noi),'#3b82f6'],['&#8722;Mortgage','&#8722;'+f$(Math.round(c.mo)),'#888'],['Net CF',f$(c.net),c.net>=0?'#22c55e':'#ef4444']];
  const ihtml=irows.map(([l,v,col],i)=>`<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f9fafb;${i===9?'border-top:2px solid #e5e7eb;font-weight:700;':''}"><span style="color:#6b7280">${l}</span><span style="color:${col};font-weight:${i===9?700:400}">${v}</span></div>`).join('');
  const arows=[['Purchase Price',f$(p.price),'#111'],['Down ('+s.down+'%)',f$(c.da),'#3b82f6'],['Closing ('+s.close+'%)',f$(c.ca),'#c9a227'],['Total OOP',f$(c.oop),'#6366f1']];
  const ahtml=arows.map(([l,v,col])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:11px"><span style="color:#6b7280">${l}</span><span style="font-weight:700;color:${col}">${v}</span></div>`).join('');
  const pts=[];
  pts.push(`<div class="d-topbar"><button class="back-btn" onclick="closeD()">&#8592; Back</button><div style="color:#fff;font-size:11px;font-weight:600;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px">${p.addr} &middot; ${f$(p.price)}</div><div style="display:flex;gap:6px;flex-shrink:0"><button onclick="openP(${JSON.stringify(id)})" style="background:#c9a227;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:600">&#128202; Proforma</button><button onclick="openR(${JSON.stringify(id)})" style="background:#22c55e;color:white;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:600">&#10003; Reserve</button></div></div>`);
  pts.push(`<div class="d-hero" id="dh_${id}"><img src="${p.photos[0]}" style="width:100%;height:100%;object-fit:cover"/><div class="d-hero-ov"></div><div class="d-hero-txt"><div class="dp">${f$(p.price)}</div><div class="da">${p.addr}, ${p.city}, ${p.state} ${p.zip} &middot; ${p.beds}bd/${p.baths}ba &middot; ${sq(p)} &middot; Built ${p.yr}</div></div><div style="position:absolute;top:12px;right:12px;display:flex;gap:5px"><span style="background:${sbg(p.status)};color:white;font-size:9px;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:uppercase">${SL[p.status]||p.status}</span><span style="background:#1a2f5e;color:white;font-size:9px;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:uppercase">${OL[p.occ]||p.occ}</span></div></div>`);
  pts.push(`<div class="d-kpis"><div class="d-kpi" style="background:#dcfce7"><div class="d-kpi-v" style="color:#166534">${f$(c.net)}/mo</div><div class="d-kpi-l" style="color:#166534">Cash Flow</div></div><div class="d-kpi" style="background:#dbeafe"><div class="d-kpi-v" style="color:#1e40af">${c.cap.toFixed(2)}%</div><div class="d-kpi-l" style="color:#1e40af">Cap Rate</div></div><div class="d-kpi" style="background:#ede9fe"><div class="d-kpi-v" style="color:#5b21b6">${c.coc.toFixed(2)}%</div><div class="d-kpi-l" style="color:#5b21b6">Cash on Cash</div></div><div class="d-kpi" style="background:#fef3c7"><div class="d-kpi-v" style="color:#92400e">${c.irr.toFixed(2)}%</div><div class="d-kpi-l" style="color:#92400e">IRR</div></div></div>`);
  pts.push(`<div class="d-body">`);
  pts.push(`<div class="d-blk"><div class="d-blk-t">Photos (${p.photos.length})</div><div id="dp_${id}" style="border-radius:8px;overflow:hidden;height:190px;background:#ddd"><img src="${p.photos[0]}" style="width:100%;height:100%;object-fit:cover"/></div></div>`);
  pts.push(`<div class="d-blk"><div class="d-blk-t">Return Targets</div>${kbars}</div>`);
  pts.push(`<div class="d-blk"><div class="d-blk-t">Acquisition</div>${ahtml}<div style="margin-top:10px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:8px;padding:12px;text-align:center"><div style="font-size:9px;color:#3b82f6;text-transform:uppercase;margin-bottom:3px">Loan Amount</div><div style="font-family:'Playfair Display',serif;font-size:19px;font-weight:700;color:#1e40af">${f$(c.ln)}</div><div style="font-size:10px;color:#6b7280;margin-top:2px">${s.rate}% &middot; ${s.term}yr &middot; <strong>${f$(c.mo)}/mo</strong></div></div></div>`);
  pts.push(`<div class="d-blk"><div class="d-blk-t">Monthly Income</div><div style="font-size:10px">${ihtml}</div></div>`);
  pts.push(`<div class="d-blk"><div class="d-blk-t">Monthly Cash Flow</div><div style="text-align:center;margin-bottom:6px"><div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:${c.net>=0?'#22c55e':'#ef4444'}">${f$(c.net)}</div><div style="font-size:10px;color:#9ca3af">per month</div></div><div style="display:flex;justify-content:space-around;margin-top:8px;font-size:10px;text-align:center"><div><div style="font-size:13px;font-weight:700;color:#22c55e">${f$(c.g)}</div><div style="color:#9ca3af">Income</div></div><div><div style="font-size:13px;font-weight:700;color:#ef4444">${f$(Math.round(c.g-c.net))}</div><div style="color:#9ca3af">Expenses</div></div><div><div style="font-size:13px;font-weight:700;color:#3b82f6">${f$(c.ln)}</div><div style="color:#9ca3af">Loan</div></div></div></div>`);
  pts.push(`<div class="d-blk"><div class="d-blk-t">Monthly Expenses</div><div style="text-align:center;margin-bottom:8px"><div style="font-family:'Playfair Display',serif;font-size:19px;font-weight:700;color:#ef4444">${f$(Math.round(c.g-c.net))}</div><div style="font-size:10px;color:#9ca3af">total/month</div></div>${ebars}</div>`);
  pts.push(`<div class="d-blk d-full" style="padding:0;overflow:hidden;height:180px"><iframe src="${mapUrl(p)}" style="width:100%;height:100%;border:none" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>`);
  pts.push('</div>');
  document.getElementById('dpage').innerHTML=pts.join('');
  document.getElementById('dov').classList.add('open');
  mkSS(`dh_${id}`,p.photos); mkSS(`dp_${id}`,p.photos);
}
function closeD(){document.getElementById('dov').classList.remove('open');document.getElementById('dpage').innerHTML='';}

// ── PROFORMA ──
function openP(id){
  const p=PROPS.find(x=>x.id===id); if(!p) return;
  if(!SS[id]) SS[id]=iS(p);
  const s=SS[id], c=calc(p,s);
  const kB=[{v:f$(c.net),l:'CF/mo',bg:'#dcfce7',c:'#166534'},{v:fp(c.cap),l:'Cap Rate',bg:'#dbeafe',c:'#1e40af'},{v:fp(c.coc),l:'CoC',bg:'#ede9fe',c:'#5b21b6'},{v:fp(c.irr),l:'IRR',bg:'#fef3c7',c:'#92400e'}];
  const flds=[['Monthly rent','rent',s.rent,''],['Vacancy %','vac',s.vac,''],['Mgmt %','mgmt',s.mgmt,''],['Maint %','maint',s.maint,'0.1'],['Down %','down',s.down,''],['Rate %','rate',s.rate,'0.1'],['Term (yrs)','term',s.term,'1'],['Closing %','close',s.close,'0.1']];
  const fhtml=flds.map(([l,k,v,st])=>`<div class="inp-r"><label>${l}</label><input data-id="${id}" data-k="${k}" type="number" value="${v}" ${st?`step="${st}`:''} oninput="pInp(${JSON.stringify(id)})"/></div>`).join('');
  const khtml=kB.map(k=>`<div class="kpi-box" style="background:${k.bg}"><div class="kv" style="color:${k.c}">${k.v}</div><div class="kl" style="color:${k.c}">${k.l}</div></div>`).join('');
  const pts=[];
  pts.push(`<button class="m-close" onclick="closeP()">&#x2715;</button>`);
  pts.push(`<div style="padding:12px 14px 0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px"><div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700">${f$(p.price)}</div><span style="background:${sbg(p.status)};color:white;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase">${SL[p.status]||p.status}</span></div>`);
  pts.push(`<div style="font-size:11px;color:#888;margin-bottom:7px">${p.addr}, ${p.city}, ${p.state} ${p.zip}</div>`);
  pts.push(`<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;padding:5px 10px;font-size:10px;color:#166534;margin-bottom:7px">Edit any field &mdash; Insurance: ${f$(p.annualIns)}/yr (${f$(p.ins)}/mo)</div></div>`);
  pts.push(`<div class="kpi-strip">${khtml}</div>`);
  pts.push(`<div class="two-col"><div><div class="col-t">Assumptions</div>${fhtml}</div>`);
  pts.push(`<div><div class="col-t">Monthly Breakdown</div><table class="brkd">`);
  pts.push(`<tr><td style="font-weight:600">Rent</td><td id="b_rent" style="color:#22c55e;font-weight:600">${f$(s.rent)}</td></tr>`);
  pts.push(`<tr><td style="color:#888">Taxes/mo</td><td>${f$(p.taxes/12)}</td></tr>`);
  pts.push(`<tr><td style="color:#888">Insurance/mo</td><td>${f$(p.ins)}</td></tr>`);
  pts.push(`<tr style="border-bottom:2px solid #e5e7eb"><td colspan="2" style="padding:0"></td></tr>`);
  pts.push(`<tr><td style="color:#888" id="b_vl">Vacancy (${s.vac}%)</td><td id="b_vac" style="color:#ef4444">&#8722;${f$(s.rent*s.vac/100)}</td></tr>`);
  pts.push(`<tr style="background:#f0fdf4"><td style="font-weight:600">Eff. Income</td><td id="b_eff" style="color:#16a34a;font-weight:600">${f$(c.g)}</td></tr>`);
  pts.push(`<tr><td style="color:#888" id="b_mgl">Mgmt (${s.mgmt}%)</td><td id="b_mgmt" style="color:#ef4444">&#8722;${f$(c.ma)}</td></tr>`);
  pts.push(`<tr><td style="color:#888" id="b_mal">Maint (${s.maint}%)</td><td id="b_maint" style="color:#ef4444">&#8722;${f$(c.xa)}</td></tr>`);
  pts.push(`<tr style="background:#eff6ff"><td style="font-weight:600">NOI</td><td id="b_noi" style="color:#2563eb;font-weight:600">${f$(c.noi)}</td></tr>`);
  pts.push(`<tr><td style="color:#888">Mortgage</td><td id="b_mort" style="color:#ef4444">&#8722;${f$(c.mo)}</td></tr>`);
  pts.push(`<tr style="border-top:2px solid #e5e7eb"><td style="font-weight:700">Net Cash Flow</td><td id="b_net" style="font-weight:700;font-size:13px;color:${c.net>=0?'#16a34a':'#ef4444'}">${f$(c.net)}</td></tr>`);
  pts.push(`</table><div style="margin-top:8px;padding-top:7px;border-top:1px solid #f3f4f6"><div class="col-t">Investment</div><table class="brkd">`);
  pts.push(`<tr><td style="color:#888" id="b_dl">Down (${s.down}%)</td><td id="b_down" style="color:#3b82f6">${f$(c.da)}</td></tr>`);
  pts.push(`<tr><td style="color:#888" id="b_cl">Closing (${s.close}%)</td><td id="b_close" style="color:#c9a227">${f$(c.ca)}</td></tr>`);
  pts.push(`<tr><td style="color:#888">Loan</td><td id="b_loan">${f$(c.ln)}</td></tr>`);
  pts.push(`<tr><td style="font-weight:700">Total OOP</td><td id="b_oop" style="font-weight:700;color:#6366f1">${f$(c.oop)}</td></tr>`);
  pts.push(`</table></div></div></div>`);
  pts.push(`<div class="act-btns">`);
  pts.push(`<button style="background:#1a2f5e;color:white;border:none;border-radius:5px;padding:8px 10px;font-size:11px;font-family:inherit;font-weight:600;cursor:pointer;flex:1" onclick="dlR(${JSON.stringify(id)})">&#11015; Download Report</button>`);
  pts.push(`<button style="background:#c9a227;color:white;border:none;border-radius:5px;padding:8px 10px;font-size:11px;font-family:inherit;font-weight:600;cursor:pointer;flex:1" onclick="closeP();openR(${JSON.stringify(id)})">&#10003; Reserve</button>`);
  pts.push(`<button style="background:#f5f4f0;color:#555;border:1px solid #ddd;border-radius:5px;padding:8px 12px;font-size:11px;font-family:inherit;cursor:pointer" onclick="rstP(${JSON.stringify(id)})">Reset</button>`);
  pts.push(`<button style="background:#f5f4f0;color:#555;border:1px solid #ddd;border-radius:5px;padding:8px 12px;font-size:11px;font-family:inherit;cursor:pointer" onclick="closeP()">Close</button>`);
  pts.push('</div>');
  document.getElementById('pmod').innerHTML=pts.join('');
  document.getElementById('pov').classList.add('open');
}
function closeP(){document.getElementById('pov').classList.remove('open');document.getElementById('pmod').innerHTML='';}
function rstP(id){const p=PROPS.find(x=>x.id===id);SS[id]=iS(p);openP(id);}

function pInp(id){
  const p=PROPS.find(x=>x.id===id), s=SS[id];
  document.querySelectorAll(`[data-id="${id}"]`).forEach(el=>{if(el.type==='number') s[el.dataset.k]=+el.value||0;});
  const c=calc(p,s);
  const set=(i,v)=>{const e=document.getElementById(i);if(e)e.textContent=v;};
  set('b_rent',f$(s.rent)); set('b_vac','\u2212'+f$(s.rent*s.vac/100)); set('b_eff',f$(c.g));
  set('b_mgmt','\u2212'+f$(c.ma)); set('b_maint','\u2212'+f$(c.xa));
  set('b_noi',f$(c.noi)); set('b_mort','\u2212'+f$(c.mo)); set('b_net',f$(c.net));
  set('b_down',f$(c.da)); set('b_close',f$(c.ca)); set('b_loan',f$(c.ln)); set('b_oop',f$(c.oop));
  const bn=document.getElementById('b_net'); if(bn) bn.style.color=c.net>=0?'#16a34a':'#ef4444';
  const set2=(i,v)=>{const e=document.getElementById(i);if(e)e.textContent=v;};
  set2('b_vl','Vacancy ('+s.vac+'%)'); set2('b_mgl','Mgmt ('+s.mgmt+'%)');
  set2('b_mal','Maint ('+s.maint+'%)'); set2('b_dl','Down ('+s.down+'%)'); set2('b_cl','Closing ('+s.close+'%)');
  const bxs=document.querySelectorAll('#pmod .kpi-box .kv');
  if(bxs[0]) bxs[0].textContent=f$(c.net); if(bxs[1]) bxs[1].textContent=fp(c.cap);
  if(bxs[2]) bxs[2].textContent=fp(c.coc); if(bxs[3]) bxs[3].textContent=fp(c.irr);
}

// ── RESERVE ──
function openR(id){
  const p=PROPS.find(x=>x.id===id); if(!p) return;
  const s=SS[id]||iS(p), c=calc(p,s);
  const pts=[];
  pts.push(`<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:13px"><div><div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700">Reserve this property</div><div style="font-size:11px;color:#888;margin-top:2px">${p.addr} &mdash; ${f$(p.price)}</div></div><button onclick="closeR()" style="background:none;border:1px solid #ddd;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:12px;color:#888;display:flex;align-items:center;justify-content:center">&#x2715;</button></div>`);
  pts.push(`<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:9px 11px;margin-bottom:13px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;color:#6b7280"><span>Price: <strong style="color:#111">${f$(p.price)}</strong></span><span>Status: <strong style="color:${sbg(p.status)}">${SL[p.status]||p.status}</strong></span><span>${p.beds}bd / ${p.baths}ba</span><span>CF: <strong style="color:#22c55e">${f$(c.net)}/mo</strong></span></div>`);
  pts.push(`<div class="rf"><label>Full Name *</label><input type="text" id="rn" placeholder="John Smith" autocomplete="name"/></div>`);
  pts.push(`<div class="rf"><label>Email *</label><input type="email" id="re" placeholder="you@example.com" autocomplete="email"/></div>`);
  pts.push(`<div class="rf"><label>Phone</label><input type="tel" id="rp" placeholder="(555) 000-0000" autocomplete="tel"/></div>`);
  pts.push(`<div class="rf"><label>Message</label><input type="text" id="rm" placeholder="Questions or notes..."/></div>`);
  pts.push(`<div style="font-size:10px;color:#aaa;margin:7px 0 3px;border-top:1px solid #eee;padding-top:7px">Not final until written confirmation received.</div>`);
  pts.push(`<button class="sub-btn" onclick="subR(${JSON.stringify(id)})">&#10003; Submit Reservation Request</button>`);
  pts.push(`<button class="can-btn" onclick="closeR()">Cancel</button>`);
  document.getElementById('rmod').innerHTML=pts.join('');
  document.getElementById('rov').classList.add('open');
}
function closeR(){document.getElementById('rov').classList.remove('open');document.getElementById('rmod').innerHTML='';}
function subR(id){
  const p=PROPS.find(x=>x.id===id);
  const nm=document.getElementById('rn').value.trim(), em=document.getElementById('re').value.trim();
  if(!nm||!em){if(!nm)document.getElementById('rn').style.borderColor='#ef4444';if(!em)document.getElementById('re').style.borderColor='#ef4444';return;}
  const ph=document.getElementById('rp').value.trim(), ms=document.getElementById('rm').value.trim();
  const s=SS[id]||iS(p), c=calc(p,s);
  const subj=encodeURIComponent('Reserve \u2014 '+p.addr+', '+p.city+' '+p.state);
  const bt='RESERVATION REQUEST\n\nAddress: '+p.addr+'\nPrice: '+f$(p.price)+'\nCF: '+f$(c.net)+'/mo\n\nName: '+nm+'\nEmail: '+em+'\nPhone: '+(ph||'N/A')+'\nMessage: '+(ms||'None');
  window.open('mailto:'+EMAILS.join(',')+'?subject='+subj+'&body='+encodeURIComponent(bt),'_blank');
  document.getElementById('rmod').innerHTML='<div style="text-align:center;padding:26px 0"><div style="width:50px;height:50px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 13px"><svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#16a34a" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg></div><div style="font-family:Playfair Display,serif;font-size:15px;font-weight:700;color:#111;margin-bottom:5px">Request Submitted!</div><div style="font-size:11px;color:#888;margin-bottom:18px">Sent to Taylor & Documents@legacyinvest.net</div><button class="sub-btn" onclick="closeR()" style="max-width:130px;margin:0 auto;font-size:11px;padding:7px">Done</button></div>';
}

// ── DOWNLOAD REPORT ──
function dlR(id){
  const p=PROPS.find(x=>x.id===id), s=SS[id]||iS(p), c=calc(p,s);
  let pr='', cum=0;
  for(let y=1;y<=10;y++){
    const ry=s.rent*Math.pow(1.03,y-1), gy=ry*(1-s.vac/100);
    const ny=gy-(p.taxes/12*Math.pow(1.02,y-1))-(p.ins*Math.pow(1.02,y-1))-(gy*s.mgmt/100)-(ry*s.maint/100);
    const cy=(ny-c.mo)*12; cum+=cy;
    const pv=p.price*Math.pow(1.03,y), ag=pv-p.price;
    const rg=((ry/s.rent-1)*100).toFixed(1), vg=((pv/p.price-1)*100).toFixed(1);
    pr+=`<tr style="${y%2===0?'background:#f8fafc':''}"><td style="font-weight:700">${y}</td><td>${f$(ry)} <span style="font-size:9px;color:#16a34a">+${rg}%</span></td><td>${f$(ny*12)}</td><td style="font-weight:600;color:#16a34a">${f$(cy)}</td><td>${f$(cum)}</td><td>${f$(pv)} <span style="font-size:9px;color:#2563eb">+${vg}%</span></td><td style="color:#2563eb;font-weight:600">${f$(ag)}</td></tr>`;
  }
  const w=window.open('','_blank'); if(!w){alert('Allow popups to download report');return;}
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Report - ${p.addr}</title><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"DM Sans",sans-serif;background:#f5f4f0;font-size:12px}.wrap{max-width:900px;margin:0 auto;background:white}.hero{position:relative;height:220px;overflow:hidden}.hero img{width:100%;height:100%;object-fit:cover}.ho{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.1),rgba(0,0,0,.7))}.ht{position:absolute;bottom:20px;left:22px;color:white;right:22px}.ht .pr{font-family:"Playfair Display",serif;font-size:26px;font-weight:700}.ht .ad{font-size:11px;opacity:.9;margin-top:3px}.ebar{background:#1a2f5e;padding:11px 18px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}.ebt{color:white;font-size:10px;font-weight:700;text-transform:uppercase;margin-right:5px}.efg{display:flex;align-items:center;gap:3px}.efg label{color:#93c5fd;font-size:9px;text-transform:uppercase}.efg input{width:55px;padding:3px 5px;border:1px solid #3b82f6;border-radius:4px;background:#0f172a;color:white;font-size:11px;text-align:center}.rc{background:#c9a227;color:white;border:none;border-radius:5px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;margin-left:auto}.sec{padding:16px 22px;border-bottom:1px solid #e5e7eb}.stl{font-family:"Playfair Display",serif;font-size:13px;font-weight:700;color:#1a2f5e;margin-bottom:13px;display:flex;align-items:center;gap:5px}.stl:after{content:"";flex:1;height:1px;background:#dbeafe}.kgrd{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:16px}.kb{border-radius:7px;padding:12px;text-align:center}.kv{font-family:"Playfair Display",serif;font-size:18px;font-weight:700}.kl{font-size:9px;text-transform:uppercase;margin-top:3px;opacity:.8}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.irow{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:11px}.il{color:#6b7280}.iv{font-weight:600}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#1a2f5e;color:white;padding:7px 9px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase}td{padding:5px 9px;border-bottom:1px solid #f0f2f5}.cta{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:10px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.rb{background:#c9a227;color:white;border:none;border-radius:8px;padding:12px 24px;font-size:13px;font-weight:700;cursor:pointer}.foot{padding:16px 22px;display:flex;justify-content:space-between;align-items:center;background:#1a2f5e;color:white;font-size:10px;flex-wrap:wrap;gap:8px}@media print{.ebar{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="wrap">`);
  w.document.write(`<div class="hero"><img src="${p.photos[0]}"/><div class="ho"></div><div class="ht"><div class="pr">${f$(p.price)}</div><div class="ad">${p.addr}, ${p.city}, ${p.state} ${p.zip}</div></div></div>`);
  w.document.write(`<div class="ebar"><span class="ebt">Edit</span><div class="efg"><label>Rent</label><input id="er" type="number" value="${s.rent}"/></div><div class="efg"><label>Vac%</label><input id="ev" type="number" value="${s.vac}"/></div><div class="efg"><label>Mgmt%</label><input id="em" type="number" value="${s.mgmt}"/></div><div class="efg"><label>Ma%</label><input id="ex" type="number" value="${s.maint}"/></div><div class="efg"><label>Dn%</label><input id="ed" type="number" value="${s.down}"/></div><div class="efg"><label>Rate</label><input id="ei" type="number" value="${s.rate}" step="0.1"/></div><div class="efg"><label>Term</label><input id="et" type="number" value="${s.term}"/></div><div class="efg"><label>Cl%</label><input id="ec" type="number" value="${s.close}"/></div><button class="rc" onclick="rc()">Recalculate</button></div>`);
  w.document.write(`<div class="sec"><div class="stl">Financial Returns</div><div class="kgrd"><div class="kb" style="background:#dcfce7"><div class="kv" style="color:#166534" id="rcf">${f$(c.net)}</div><div class="kl" style="color:#166534">Cash Flow/mo</div></div><div class="kb" style="background:#dbeafe"><div class="kv" style="color:#1e40af" id="rcp">${fp(c.cap)}</div><div class="kl" style="color:#1e40af">Cap Rate</div></div><div class="kb" style="background:#ede9fe"><div class="kv" style="color:#5b21b6" id="rcc">${fp(c.coc)}</div><div class="kl" style="color:#5b21b6">Cash on Cash</div></div><div class="kb" style="background:#fef3c7"><div class="kv" style="color:#92400e" id="rci">${fp(c.irr)}</div><div class="kl" style="color:#92400e">IRR</div></div></div>`);
  w.document.write(`<div class="two"><div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#374151;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Financing</div><div class="irow"><span class="il">Purchase Price</span><span class="iv">${f$(p.price)}</span></div><div class="irow"><span class="il" id="ldl">Down (${s.down}%)</span><span id="rdn" class="iv" style="color:#3b82f6">${f$(c.da)}</span></div><div class="irow"><span class="il" id="lcl">Closing (${s.close}%)</span><span id="rcl" class="iv" style="color:#c9a227">${f$(c.ca)}</span></div><div class="irow"><span class="il">Total OOP</span><span id="rop" style="font-weight:700;color:#7c3aed">${f$(c.oop)}</span></div><div class="irow"><span class="il">Loan</span><span id="rln" class="iv">${f$(c.ln)}</span></div><div class="irow"><span class="il">Mortgage/mo</span><span id="rmo" style="font-weight:700;color:#ef4444">${f$(c.mo)}</span></div></div>`);
  w.document.write(`<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#374151;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Monthly Income & Expenses</div><div class="irow"><span class="il">Gross Rent</span><span id="rrt" style="color:#16a34a">${f$(s.rent)}</span></div><div class="irow"><span class="il" id="lvl">Vacancy (${s.vac}%)</span><span id="rvc" style="color:#ef4444">\u2212${f$(Math.round(s.rent*s.vac/100))}</span></div><div class="irow"><span class="il">Eff. Income</span><span id="ref" style="color:#16a34a;font-weight:700">${f$(c.g)}</span></div><div class="irow"><span class="il">Taxes/mo</span><span style="color:#ef4444">\u2212${f$(Math.round(p.taxes/12))}</span></div><div class="irow"><span class="il">Ins/mo</span><span style="color:#ef4444">\u2212${f$(Math.round(p.ins))}</span></div><div class="irow"><span class="il" id="lml">Mgmt (${s.mgmt}%)</span><span id="rmg" style="color:#ef4444">\u2212${f$(Math.round(c.ma))}</span></div><div class="irow"><span class="il" id="lxl">Maint (${s.maint}%)</span><span id="rxt" style="color:#ef4444">\u2212${f$(Math.round(c.xa))}</span></div><div class="irow"><span class="il">NOI</span><span id="rni" style="color:#2563eb;font-weight:700">${f$(c.noi)}</span></div><div class="irow" style="border-top:2px solid #e5e7eb;padding-top:5px"><span class="il" style="font-weight:700">Net Cash Flow</span><span id="rnt" style="font-weight:700;color:${c.net>=0?'#16a34a':'#ef4444'}">${f$(c.net)}</span></div></div></div></div>`);
  w.document.write(`<div class="sec"><div class="stl">10-Year Projections</div><p style="font-size:10px;color:#6b7280;margin-bottom:12px">3% rent growth &bull; 2% expense growth &bull; 3% appreciation</p><div style="overflow-x:auto"><table><thead><tr><th>Yr</th><th>Rent/mo</th><th>NOI/yr</th><th>CF/yr</th><th>Cum CF</th><th>Value</th><th>Appreciation</th></tr></thead><tbody>${pr}</tbody></table></div></div>`);
  w.document.write(`<div class="sec" style="background:#f9fafb"><div class="cta"><div><div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#111;margin-bottom:3px">Ready to reserve?</div><div style="font-size:11px;color:#6b7280">${p.addr} &middot; ${f$(p.price)}</div></div><button class="rb" onclick="window.open('mailto:Taylor@legacyinvest.net,Documents@legacyinvest.net')">Reserve This Property</button></div></div>`);
  w.document.write(`<div class="foot"><div><div style="font-family:'Playfair Display',serif;font-size:13px;font-weight:700;margin-bottom:2px">LEGACY INVEST REALTY</div><div style="opacity:.7">Investment Property Analysis</div></div><div style="text-align:right;opacity:.85;line-height:1.7"><div>Taylor@legacyinvest.net &middot; Documents@legacyinvest.net</div><div>(731) 324-3126</div></div></div></div>`);
  const sc=`var P=${p.price},TX=${p.taxes},IN=${p.ins};var f$=n=>'$'+Math.round(n).toLocaleString();var fp=n=>n.toFixed(2)+'%';const gi=id=>parseFloat(document.getElementById(id).value)||0;const st=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};function calcR(s){const g=s.r*(1-s.v/100),tm=TX/12,im=IN,ma=g*s.m/100,xa=s.r*s.x/100,noi=g-tm-im-ma-xa,ln=P*(1-s.d/100),r=s.i/100/12,n=s.t*12,mo=r>0?ln*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):ln/n,net=noi-mo,da=P*s.d/100,ca=P*s.c/100,oop=da+ca,cap=P>0?(noi*12/P)*100:0,coc=oop>0?(net*12/oop)*100:0,irr=Math.max(0,coc*1.75+cap*0.3);return{g,noi,mo,net,ln,oop,cap,coc,irr,da,ca,ma,xa};}function rc(){const s={r:gi('er'),v:gi('ev'),m:gi('em'),x:gi('ex'),d:gi('ed'),i:gi('ei'),t:gi('et'),c:gi('ec')};const c=calcR(s);st('rcf',f$(c.net));st('rcp',fp(c.cap));st('rcc',fp(c.coc));st('rci',fp(c.irr));const rn=document.getElementById('rnt');if(rn){rn.textContent=f$(c.net);rn.style.color=c.net>=0?'#16a34a':'#ef4444';}st('ldl','Down ('+s.d+'%)');st('rdn',f$(c.da));st('lcl','Closing ('+s.c+'%)');st('rcl',f$(c.ca));st('rop',f$(c.oop));st('rln',f$(c.ln));st('rmo',f$(c.mo));st('rrt',f$(s.r));st('lvl','Vacancy ('+s.v+'%)');st('rvc','\u2212'+f$(Math.round(s.r*s.v/100)));st('ref',f$(c.g));st('lml','Mgmt ('+s.m+'%)');st('rmg','\u2212'+f$(Math.round(c.ma)));st('lxl','Maint ('+s.x+'%)');st('rxt','\u2212'+f$(Math.round(c.xa)));st('rni',f$(c.noi));}`;
  const sel=w.document.createElement('script'); sel.textContent=sc; w.document.body.appendChild(sel);
  w.document.close();
}

loadProps();

