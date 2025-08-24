/* ===========================================================
   static/main.js — v5  (dark‑mode + bug‑fix + full chip list)
   =========================================================== */

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = CSS.escape;

/* ---------- THEME --------------------------------------------------- */
(function initTheme(){
  const root = document.documentElement;
  const pref = localStorage.getItem("theme") || "dark";
  root.setAttribute("data-theme", pref);

  $("#themeBtn").textContent = pref === "dark" ? "Light" : "Dark";
  $("#themeBtn").onclick = () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    $("#themeBtn").textContent = next === "dark" ? "Light" : "Dark";
  };
})();

/* ---------- build tree --------------------------------------------- */
function renderNode(node){
  const li = document.createElement("li");
  li.className = "row "+node.type;

  // ► toggle button – type="button" fixes reload bug
  const btn = document.createElement("button");
  btn.className = "toggle";
  btn.type = "button";
  btn.textContent = node.type==="dir" ? "▶" : "";
  li.appendChild(btn);

  const cb = document.createElement("input");
  cb.type="checkbox"; cb.dataset.path=node.path;
  li.appendChild(cb);

  const name = document.createElement("span");
  name.className="name"; name.textContent=node.name;
  li.appendChild(name);

  if(node.type==="dir"){
    const ul=document.createElement("ul"); ul.hidden=true;
    node.children.forEach(ch=>ul.appendChild(renderNode(ch)));
    li.appendChild(ul);

    btn.onclick = () => { ul.hidden=!ul.hidden; btn.textContent = ul.hidden?"▶":"▼"; };
    name.onclick = () => btn.click();

    cb.onchange = e => {
      ul.querySelectorAll("input[type=checkbox]")
        .forEach(c=>c.checked=e.target.checked);
      refreshUI();
    };
  } else {
    btn.style.visibility="hidden";
    cb.onchange = refreshUI;
  }
  return li;
}
function buildTree(){
  const root = document.createElement("ul");
  TREE_DATA.children.forEach(ch=>root.appendChild(renderNode(ch)));
  $("#treeForm").appendChild(root);
}

/* ---------- localStorage helpers ----------------------------------- */
const ls = {
  get : (k,d)=>JSON.parse(localStorage.getItem(k)||d),
  set : (k,v)=>localStorage.setItem(k,JSON.stringify(v))
};

/* ---------- frequent + groups (same logic) ------------------------- */
function bumpUsage(paths){
  const u=ls.get("fileUsageCounts","{}");
  paths.forEach(p=>u[p]=(u[p]||0)+1);
  ls.set("fileUsageCounts",u);
  renderFreqList();
}
function renderFreqList(){
  const u=ls.get("fileUsageCounts","{}");
  const list=$("#freqList"); list.innerHTML="";
  Object.entries(u).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([p])=>{
    const b=document.createElement("button");
    b.type="button"; b.textContent=p.split("/").pop();
    b.title=p; b.onclick=()=>togglePath(p); list.appendChild(b);
  });
}
function renderGroupList(){
  const g=ls.get("savedGroups","[]");
  const box=$("#groupList"); box.innerHTML="";
  g.forEach((grp,i)=>{
    const wrap=document.createElement("div"); wrap.className="grp";
    wrap.innerHTML=`<span>${grp.name}</span>`;
    const sel=document.createElement("button"); sel.textContent="Select"; sel.type="button";
    sel.onclick=()=>selectGroup(grp.paths);
    const del=document.createElement("button"); del.textContent="🗑︎"; del.type="button";
    del.onclick=()=>{g.splice(i,1);ls.set("savedGroups",g);renderGroupList();};
    wrap.append(sel,del); box.appendChild(wrap);
  });
}
function saveGroup(){
  const paths=selected(); if(!paths.length)return;
  const name=prompt("Group name?"); if(!name)return;
  const g=ls.get("savedGroups","[]"); g.push({name,paths});
  ls.set("savedGroups",g); renderGroupList();
}

/* ---------- selection utilities ------------------------------------ */
const selected = () => $$("input[data-path]:checked").map(cb=>cb.dataset.path);
function togglePath(p){
  const cb=$(`input[data-path="${esc(p)}"]`); if(cb){cb.checked=!cb.checked;refreshUI();}
}
function selectGroup(paths){
  $$("input[data-path]").forEach(cb=>cb.checked=false);
  paths.forEach(p=>{const cb=$(`input[data-path="${esc(p)}"]`); if(cb)cb.checked=true;});
  refreshUI();
}

/* ---------- live selection bar (no overflow) ----------------------- */
function renderSelBar(){
  const bar=$("#selBar"); bar.innerHTML="";
  selected().forEach(p=>{
    const chip=document.createElement("span"); chip.className="chip";
    chip.textContent=p.split("/").pop(); chip.title=p;
    chip.onclick=()=>togglePath(p);
    bar.appendChild(chip);
  });
}

/* ---------- buttons state update ----------------------------------- */
function refreshUI(){
  const any=selected().length>0;
  $("#copyBtn").disabled=!any;
  $("#saveGroupBtn").disabled=!any;
  renderSelBar();
}

/* ---------- clipboard copy (sync + fallback) ----------------------- */
function copyHandler(){
  const paths=selected(); if(!paths.length)return;
  const xhr=new XMLHttpRequest();
  xhr.open("POST","/read-files",false);
  xhr.setRequestHeader("Content-Type","application/json");
  xhr.send(JSON.stringify({paths}));
  if(xhr.status<200||xhr.status>=300){alert("Server error");return;}
  const text=JSON.parse(xhr.responseText).merged;

  const done=ok=>{ if(ok){bumpUsage(paths);refreshUI();} };
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(text).then(()=>done(true)).catch(()=>fallback(text,done));
  }else fallback(text,done);
}
function fallback(text,cb){
  const ta=document.createElement("textarea");
  Object.assign(ta.style,{position:"absolute",top:0,left:0,opacity:0});
  ta.value=text; document.body.appendChild(ta);
  ta.select(); ta.setSelectionRange(0,ta.value.length);
  const ok=document.execCommand("copy"); document.body.removeChild(ta);
  cb(ok);
}

/* ---------- Git update (unchanged) --------------------------------- */
async function updateRepo(){
  const branch=$("#branchSelect").value;
  const b=$("#updateBtn"); b.disabled=true; const t=b.textContent; b.textContent="Updating…";
  try{
    const r=await fetch("/update-repo",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({branch})
    });
    const j=await r.json();
    alert(j.ok?"Repo updated:\n\n"+j.log:"Update failed:\n\n"+j.log);
    if(j.ok)location.reload();
  }catch(e){alert(e);}finally{b.textContent=t;b.disabled=false;}
}

/* ---------- init --------------------------------------------------- */
buildTree(); renderFreqList(); renderGroupList(); refreshUI();
$("#copyBtn").onclick=copyHandler;
$("#saveGroupBtn").onclick=saveGroup;
$("#updateBtn").onclick=updateRepo;

