/* =======================================================================
   static/main.js   —  v3 with Quick‑Select Helpers
   ===================================================================== */

/* ---------- tiny helpers --------------------------------------------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* ---------- build file tree  ----------------------------------------- */
function renderNode(node) {
    const li = document.createElement("li");
    li.className = node.type;
    const label = document.createElement("label");
    const cb    = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.path = node.path;
    label.append(cb, " ", node.name);
    li.appendChild(label);

    if (node.type === "dir") {
        const ul = document.createElement("ul");
        ul.hidden = true;
        node.children.forEach(ch => ul.appendChild(renderNode(ch)));
        li.appendChild(ul);

        label.addEventListener("click", e =>
            e.target.tagName !== "INPUT" && (ul.hidden = !ul.hidden));

        cb.addEventListener("change", e => {
            ul.querySelectorAll("input[type=checkbox]")
              .forEach(c => { c.checked = e.target.checked; });
            refreshButtons();
        });
    } else {
        cb.addEventListener("change", refreshButtons);
    }
    return li;
}

function buildTree() {
    const root = document.createElement("ul");
    TREE_DATA.children.forEach(ch => root.appendChild(renderNode(ch)));
    $("#treeForm").appendChild(root);
}

/* ---------- localStorage helpers ------------------------------------ */
function lsGet(key, def) { return JSON.parse(localStorage.getItem(key) || def); }
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* ---------- Frequent files ------------------------------------------ */
function bumpUsage(paths) {
    const usage = lsGet("fileUsageCounts", "{}");
    paths.forEach(p => usage[p] = (usage[p] || 0) + 1);
    lsSet("fileUsageCounts", usage);
}

function renderFreqList() {
    const usage = lsGet("fileUsageCounts", "{}");
    const top10 = Object.entries(usage)
                     .sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>e[0]);
    const box = $("#freqList");
    box.innerHTML = "";
    top10.forEach(path => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = path.split("/").pop();   // show filename only
        btn.title = path;
        btn.addEventListener("click", ()=> togglePath(path));
        box.appendChild(btn);
    });
}

/* ---------- Saved groups -------------------------------------------- */
function renderGroupList() {
    const groups = lsGet("savedGroups", "[]");
    const box = $("#groupList");
    box.innerHTML = "";
    groups.forEach((g,i) => {
        const div = document.createElement("div");
        div.className = "grp";

        const title = document.createElement("span");
        title.textContent = g.name;
        div.appendChild(title);

        const selBtn = document.createElement("button");
        selBtn.textContent = "Select";
        selBtn.type = "button";
        selBtn.addEventListener("click", ()=> selectGroup(g.paths));
        div.appendChild(selBtn);

        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑︎";
        delBtn.type = "button";
        delBtn.addEventListener("click", ()=> {
            groups.splice(i,1);
            lsSet("savedGroups", groups);
            renderGroupList();
        });
        div.appendChild(delBtn);
        box.appendChild(div);
    });
}

function saveCurrentGroup() {
    const paths = $$("#treeForm input[data-path]:checked").map(cb=>cb.dataset.path);
    const name  = prompt("Group name?");
    if (!name) return;
    const groups = lsGet("savedGroups", "[]");
    groups.push({name, paths});
    lsSet("savedGroups", groups);
    renderGroupList();
}

/* ---------- selection helpers --------------------------------------- */
function togglePath(path) {
    const cb = $(`#treeForm input[data-path="${CSS.escape(path)}"]`);
    if (cb) { cb.checked = !cb.checked; refreshButtons(); }
}
function selectGroup(paths) {
    // clear all first
    $$("#treeForm input[data-path]").forEach(cb=> cb.checked=false);
    paths.forEach(togglePath);
    refreshButtons();
}

/* ---------- main action buttons ------------------------------------- */
function refreshButtons() {
    const any = $$("#treeForm input[data-path]:checked").length>0;
    $("#copyBtn").disabled       = !any;
    $("#saveGroupBtn").disabled  = !any;
}

/* ----- Clipboard copy (synchronous + fallback, as proven) ------------- */
function copyToClipboardHandler() {
    const paths = $$("#treeForm input[data-path]:checked").map(cb=>cb.dataset.path);
    if (!paths.length) return;
    /* sync XHR keeps us in gesture */
    const xhr = new XMLHttpRequest();
    xhr.open("POST","/read-files",false);
    xhr.setRequestHeader("Content-Type","application/json");
    xhr.send(JSON.stringify({paths}));

    if (xhr.status<200 || xhr.status>=300) { alert("Server error"); return;}
    const text = JSON.parse(xhr.responseText).merged;

    const done = ok => {
        if (ok) {
            alert(`Copied ${paths.length} file(s)`);
            bumpUsage(paths);
            renderFreqList();
        } else {
            alert("Copy blocked by browser.");
        }
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(()=>done(true))
                 .catch(()=> fallbackCopy(text,done));
    } else {
        fallbackCopy(text,done);
    }
}

function fallbackCopy(text, cb) {
    const ta = document.createElement("textarea");
    Object.assign(ta.style,{position:"absolute",top:0,left:0,opacity:0});
    ta.value=text; document.body.appendChild(ta);
    ta.focus(); ta.select(); ta.setSelectionRange(0,ta.value.length);
    const ok=document.execCommand("copy");
    document.body.removeChild(ta);
    cb(ok);
}

/* ---------- Git update (unchanged) ----------------------------------- */
async function updateRepo() {
    const b=$("#updateBtn"); b.disabled=true; const t=b.textContent; b.textContent="Updating…";
    try {
        const r=await fetch("/update-repo",{method:"POST"}); const j=await r.json();
        alert(j.ok?"Repo updated:\n\n"+j.log:"Update failed:\n\n"+j.log);
        if(j.ok) location.reload();
    } catch(e){ alert(e);}
    finally{ b.textContent=t; b.disabled=false;}
}

/* ---------- init ----------------------------------------------------- */
buildTree();
renderFreqList();
renderGroupList();
$("#copyBtn").addEventListener("click", copyToClipboardHandler);
$("#updateBtn").addEventListener("click", updateRepo);
$("#saveGroupBtn").addEventListener("click", saveCurrentGroup);

