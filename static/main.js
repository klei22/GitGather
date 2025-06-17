/* =======================================================================
     File: static/main.js    (drop‑in replacement)
   ===================================================================== */

function renderNode(node) {
    const li = document.createElement("li");
    li.className = node.type;

    // Checkbox + label
    const label = document.createElement("label");
    const cb    = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.path = node.path;
    label.appendChild(cb);
    label.append(" ", node.name);
    li.appendChild(label);

    // Folder‑specific logic
    if (node.type === "dir") {
        const ul = document.createElement("ul");
        ul.hidden = true;                        // collapsed by default
        node.children.forEach(ch => ul.appendChild(renderNode(ch)));
        li.appendChild(ul);

        // Toggle open/close when tapping the folder name
        label.addEventListener("click", e => {
            if (e.target.tagName !== "INPUT") ul.hidden = !ul.hidden;
        });
        // Cascade checkbox state
        cb.addEventListener("change", e => {
            ul.querySelectorAll("input[type='checkbox']")
              .forEach(child => { child.checked = e.target.checked; });
            updateCopyButton();
        });
    } else {
        cb.addEventListener("change", updateCopyButton);
    }
    return li;
}

function buildTree() {
    const rootUL = document.createElement("ul");
    TREE_DATA.children.forEach(ch => rootUL.appendChild(renderNode(ch)));
    document.getElementById("treeForm").appendChild(rootUL);
}

/* ---------- Enable/disable “Copy” button -------------------------------- */
function updateCopyButton() {
    const any = Array.from(document.querySelectorAll("input[data-path]"))
                      .some(cb => cb.checked);
    document.getElementById("copyBtn").disabled = !any;
}

/* ---------- Hardened clipboard logic ------------------------------------ */
function copyToClipboardHandler() {
    /* Gather selected paths */
    const paths = Array.from(
        document.querySelectorAll("input[data-path]:checked")
    ).map(cb => cb.dataset.path);
    if (!paths.length) return;                // nothing selected

    /* SYNC request to keep us inside the click gesture */
    let text;
    try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/read-files", false);      // 3rd arg = false → synchronous
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({paths}));
        if (xhr.status >= 200 && xhr.status < 300) {
            text = JSON.parse(xhr.responseText).merged;
        } else {
            alert("Failed to fetch file contents ("+xhr.status+")");
            return;
        }
    } catch (e) {
        alert("XHR error: " + e.message);
        return;
    }

    /* Try modern API first */
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            alert(`Copied ${paths.length} file(s) to clipboard.`);
        }).catch(_ => fallbackCopy(text, paths.length));
    } else {
        fallbackCopy(text, paths.length);
    }
}

function fallbackCopy(text, count) {
    /* Visible‑but‑transparent textarea inside viewport (iOS requirement) */
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "absolute";
    ta.style.top  = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);

    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);   // Firefox Mobile quirk

    const ok = document.execCommand("copy");
    document.body.removeChild(ta);

    alert(ok
        ? `Copied ${count} file(s) to clipboard (fallback).`
        : "Sorry, your browser blocked the copy action.");
}

/* ---------- Git update (unchanged) ------------------------------------- */
async function updateRepo() {
    const btn = document.getElementById("updateBtn");
    btn.disabled = true;
    const txt = btn.textContent;
    btn.textContent = "Updating…";
    try {
        const res = await fetch("/update-repo", {method:"POST"});
        const data = await res.json();
        alert(data.ok ? "Repo updated:\n\n"+data.log
                      : "Update failed:\n\n"+data.log);
        if (data.ok) location.reload();
    } catch(e) {
        alert("Request failed: " + e);
    } finally {
        btn.textContent = txt;
        btn.disabled = false;
    }
}

/* ---------- Init ------------------------------------------------------- */
buildTree();
document.getElementById("copyBtn").addEventListener("click", copyToClipboardHandler);
document.getElementById("updateBtn").addEventListener("click", updateRepo);
