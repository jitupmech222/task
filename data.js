// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ત્રણેય ટેબલનું સ્ટ્રક્ચર (Primary Key અને Columns)
const TABLE_CONFIG = {
  task_nse: {
    pk: "sr_no",
    orderCol: "sr_no",
    columns: [
      "sr_no",
      "date",
      "stock_name",
      "buy_price",
      "buy_qty",
      "buy_charges",
      "buy_amount",
      "sell_price",
      "sell_qty",
      "sell_charges",
      "sell_amount",
      "total_trn_amount",
      "total_charges",
      "gross_profit_loss",
      "net_profit_loss",
      "sattelment",
      "opening_balance",
      "closing_balance",
      "for_saving",
      "for_task",
      "actually_closing"
    ]
  },
  nse_task: {
    pk: "task_number",
    orderCol: "task_number",
    columns: ["task_number", "task_amount", "task_level", "status"]
  },
  nse_task_trades: {
    pk: "sr_no",
    orderCol: "sr_no",
    columns: [
      "sr_no",
      "task_number",
      "date",
      "stock_name",
      "buy_price",
      "buy_qty",
      "buy_charges",
      "buy_amount",
      "sell_price",
      "sell_qty",
      "sell_charges",
      "sell_amount",
      "total_trn_amount",
      "total_charges",
      "gross_profit_loss",
      "net_profit_loss"
    ]
  }
};

let currentTable = "task_nse";
let rawRows = [];
let filteredRows = [];
let activeFilters = {}; // { colName: Set of allowed string values }
let currentFilterCol = null;
let editingPkValue = null;

const thead = document.getElementById("data-thead");
const tbody = document.getElementById("data-tbody");
const filterPopup = document.getElementById("column-filter-popup");

// 1. ટેબલ બટન સ્વિચિંગ (task_nse / nse_task / nse_task_trades)
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTable = btn.dataset.table;
    activeFilters = {};
    filterPopup.style.display = "none";
    loadTableData();
  });
});

// 2. પસંદ કરેલા ટેબલનો ડેટા Supabase માંથી લાવો
async function loadTableData() {
  const cfg = TABLE_CONFIG[currentTable];
  document.getElementById("active-table-title").innerText = `Table: ${currentTable}`;
  thead.innerHTML = "";
  tbody.innerHTML = '<tr><td>ડેટા લોડ થઈ રહ્યો છે...</td></tr>';

  const { data, error } = await supabaseClient
    .from(currentTable)
    .select("*")
    .order(cfg.orderCol, { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td style="color:red;">ડેટાબેઝ એરર: ${error.message}</td></tr>`;
    return;
  }

  rawRows = data || [];
  applyFiltersAndRender();
}

// 3. ફિલ્ટર લાગુ કરીને ટેબલ બતાવો
function applyFiltersAndRender() {
  const cfg = TABLE_CONFIG[currentTable];

  filteredRows = rawRows.filter((row) => {
    return Object.keys(activeFilters).every((col) => {
      const allowedSet = activeFilters[col];
      if (!allowedSet) return true;
      const valStr = row[col] === null || row[col] === undefined ? "(Blank)" : String(row[col]);
      return allowedSet.has(valStr);
    });
  });

  document.getElementById("row-count-badge").innerText = `(${filteredRows.length} / ${rawRows.length} rows)`;

  // Header બનાવો (દરેક કોલમ પર Filter બટન સાથે)
  const trHead = document.createElement("tr");
  const thAction = document.createElement("th");
  thAction.innerText = "Actions";
  trHead.appendChild(thAction);

  cfg.columns.forEach((col) => {
    const th = document.createElement("th");
    th.style.whiteSpace = "nowrap";
    const isFiltered = Boolean(activeFilters[col]);
    th.innerHTML = `${col} <button type="button" class="th-filter-btn ${isFiltered ? "filtered" : ""}" data-col="${col}">▼</button>`;
    trHead.appendChild(th);
  });

  thead.innerHTML = "";
  thead.appendChild(trHead);

  // Filter બટન ક્લિક ઇવેન્ટ
  thead.querySelectorAll(".th-filter-btn").forEach((fBtn) => {
    fBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openColumnFilter(fBtn.dataset.col, fBtn);
    });
  });

  // Body રો બનાવો
  if (filteredRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cfg.columns.length + 1}">કોઈ ડેટા મળ્યો નથી.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  filteredRows.forEach((row) => {
    const tr = document.createElement("tr");

    // Edit અને Delete બટન
    const tdAct = document.createElement("td");
    tdAct.style.whiteSpace = "nowrap";
    tdAct.innerHTML = `
      <button type="button" class="mini-btn edit-row-btn" style="padding: 4px 8px; font-size: 12px; background:#2563eb;">✏️</button>
      <button type="button" class="mini-btn del-row-btn" style="padding: 4px 8px; font-size: 12px; background:#dc2626; margin-left:4px;">🗑️</button>
    `;

    tdAct.querySelector(".edit-row-btn").addEventListener("click", () => openEditModal(row));
    tdAct.querySelector(".del-row-btn").addEventListener("click", () => deleteRow(row));
    tr.appendChild(tdAct);

    cfg.columns.forEach((col) => {
      const td = document.createElement("td");
      td.style.whiteSpace = "nowrap";
      const val = row[col];
      td.innerText = val === null || val === undefined ? "" : val;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// 4. Excel-style Column Filter Popup
function openColumnFilter(col, btnEl) {
  currentFilterCol = col;
  document.getElementById("filter-col-title").innerText = `Filter: ${col}`;
  document.getElementById("filter-search-input").value = "";

  const uniqueVals = Array.from(
    new Set(rawRows.map((r) => (r[col] === null || r[col] === undefined ? "(Blank)" : String(r[col]))))
  ).sort();

  const container = document.getElementById("filter-values-container");
  container.innerHTML = "";

  const existingSet = activeFilters[col];

  uniqueVals.forEach((v) => {
    const checked = !existingSet || existingSet.has(v) ? "checked" : "";
    const lbl = document.createElement("label");
    lbl.innerHTML = `<input type="checkbox" value="${v.replace(/"/g, "&quot;")}" ${checked} /> <span>${v}</span>`;
    container.appendChild(lbl);
  });

  const rect = btnEl.getBoundingClientRect();
  filterPopup.style.display = "flex";
  filterPopup.style.top = `${Math.min(window.innerHeight - 330, rect.bottom + 5)}px`;
  filterPopup.style.left = `${Math.min(window.innerWidth - 255, Math.max(10, rect.left - 100))}px`;
}

document.getElementById("filter-search-input").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll("#filter-values-container label").forEach((lbl) => {
    lbl.style.display = lbl.innerText.toLowerCase().includes(q) ? "flex" : "none";
  });
});

document.getElementById("btn-select-all-filter").addEventListener("click", () => {
  document.querySelectorAll("#filter-values-container input[type='checkbox']").forEach((cb) => {
    if (cb.parentElement.style.display !== "none") cb.checked = true;
  });
});

document.getElementById("btn-deselect-all-filter").addEventListener("click", () => {
  document.querySelectorAll("#filter-values-container input[type='checkbox']").forEach((cb) => {
    if (cb.parentElement.style.display !== "none") cb.checked = false;
  });
});

document.getElementById("btn-apply-filter").addEventListener("click", () => {
  const allBoxes = Array.from(document.querySelectorAll("#filter-values-container input[type='checkbox']"));
  const checkedBoxes = allBoxes.filter((cb) => cb.checked);

  if (checkedBoxes.length === allBoxes.length) {
    delete activeFilters[currentFilterCol];
  } else {
    activeFilters[currentFilterCol] = new Set(checkedBoxes.map((cb) => cb.value));
  }

  filterPopup.style.display = "none";
  applyFiltersAndRender();
});

document.getElementById("btn-cancel-filter").addEventListener("click", () => {
  filterPopup.style.display = "none";
});

document.getElementById("btn-clear-filters").addEventListener("click", () => {
  activeFilters = {};
  filterPopup.style.display = "none";
  applyFiltersAndRender();
});

// 5. Edit Record Modal
function openEditModal(row) {
  const cfg = TABLE_CONFIG[currentTable];
  editingPkValue = row[cfg.pk];

  document.getElementById("edit-modal-title").innerText = `Edit ${currentTable} (${cfg.pk}: ${editingPkValue})`;
  const container = document.getElementById("edit-fields-container");
  container.innerHTML = "";

  cfg.columns.forEach((col) => {
    const isPk = col === cfg.pk;
    const val = row[col] === null || row[col] === undefined ? "" : row[col];

    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    div.innerHTML = `
      <label style="font-size: 13px; font-weight: bold; display:block; margin-bottom:3px;">${col}:</label>
      <input type="text" data-col="${col}" value="${String(val).replace(/"/g, "&quot;")}" ${isPk ? "readonly style='background:#e2e8f0; width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:5px; box-sizing:border-box;'" : "style='width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:5px; box-sizing:border-box;'"} />
    `;
    container.appendChild(div);
  });

  document.getElementById("edit-modal").style.display = "flex";
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
  editingPkValue = null;
}

document.getElementById("btn-close-modal").addEventListener("click", closeEditModal);
document.getElementById("btn-cancel-edit").addEventListener("click", closeEditModal);

document.getElementById("btn-save-edit").addEventListener("click", async () => {
  const cfg = TABLE_CONFIG[currentTable];
  const updateObj = {};

  document.querySelectorAll("#edit-fields-container input").forEach((inp) => {
    const col = inp.dataset.col;
    if (col === cfg.pk) return;
    const rawVal = inp.value.trim();
    updateObj[col] = rawVal === "" ? null : rawVal;
  });

  const { error } = await supabaseClient
    .from(currentTable)
    .update(updateObj)
    .eq(cfg.pk, editingPkValue);

  if (error) {
    alert("અપડેટ કરવામાં એરર આવી: " + error.message);
  } else {
    alert("રેકોર્ડ સફળતાપૂર્વક અપડેટ થઈ ગયો!");
    closeEditModal();
    await loadTableData();
  }
});

// 6. Delete Record
async function deleteRow(row) {
  const cfg = TABLE_CONFIG[currentTable];
  const pkVal = row[cfg.pk];

  if (!confirm(`શું તમે ખરેખર ${currentTable} માંથી ${cfg.pk} = ${pkVal} ડિલીટ કરવા માંગો છો?`)) {
    return;
  }

  const { error } = await supabaseClient
    .from(currentTable)
    .delete()
    .eq(cfg.pk, pkVal);

  if (error) {
    alert("ડિલીટ કરવામાં એરર આવી: " + error.message);
  } else {
    alert("રેકોર્ડ ડિલીટ થઈ ગયો!");
    await loadTableData();
  }
}

// 7. Download Excel (.xlsx)
document.getElementById("btn-download-excel").addEventListener("click", () => {
  if (filteredRows.length === 0) {
    alert("ડાઉનલોડ કરવા માટે કોઈ ડેટા નથી!");
    return;
  }

  const cfg = TABLE_CONFIG[currentTable];
  const exportData = filteredRows.map((r) => {
    const obj = {};
    cfg.columns.forEach((col) => {
      obj[col] = r[col] ?? "";
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, currentTable);
  XLSX.writeFile(wb, `${currentTable}_data.xlsx`);
});

document.getElementById("btn-refresh-data").addEventListener("click", loadTableData);

// પેજ લોડ થતા ડિફોલ્ટ task_nse લોડ કરો
loadTableData();
