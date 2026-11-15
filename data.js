// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const fullColumns = [
  "sr_no", "date", "stock_name", "buy_price", "buy_qty", "buy_charges",
  "sell_price", "sell_qty", "sell_charges", "buy_amount", "sell_amount",
  "total_trn_amount", "total_charges", "gross_profit_loss", "net_profit_loss",
  "opening_balance", "closing_balance", "for_saving", "for_task"
];

const customColumns = [
  "sr_no", "date", "stock_name", "buy_price", "sell_price",
  "net_profit_loss", "opening_balance", "closing_balance"
];

let rawData = [];
let filteredData = [];
let currentColumns = fullColumns;
let currentViewName = "Full_Data";
let activeFilters = {}; // { columnName: Set(['val1', 'val2']) }
let currentFilterCol = null;
let editingSrNo = null;

const thead = document.getElementById("data-thead");
const tbody = document.getElementById("data-tbody");
const viewTitle = document.getElementById("view-title");

// વેલ્યુને ટેક્સ્ટમાં ફેરવવા માટે (ખાલી હોય તો '(Blank)')
function getDisplayVal(val) {
  return val !== null && val !== undefined && val !== "" ? String(val) : "(Blank)";
}

// Supabase માંથી ડેટા લોડ કરો
async function loadDatabase() {
  tbody.innerHTML = "<tr><td>ડેટા લોડ થઈ રહ્યો છે...</td></tr>";
  const { data, error } = await supabaseClient
    .from("task_nse")
    .select("*")
    .order("sr_no", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td style="color:red;">એરર આવી: ${error.message}</td></tr>`;
    return;
  }

  rawData = data;
  applyFiltersAndRender();
}

// હેડર અને દરેક કોલમ પર 🔽 ફિલ્ટર બટન બનાવો
function buildHeader() {
  thead.innerHTML = "";
  const tr = document.createElement("tr");

  currentColumns.forEach((col) => {
    const th = document.createElement("th");
    th.className = "excel-th";

    const wrapper = document.createElement("div");
    wrapper.className = "th-flex";

    const titleSpan = document.createElement("span");
    titleSpan.innerText = col.toUpperCase().replace(/_/g, " ");

    const filterBtn = document.createElement("button");
    filterBtn.type = "button";
    const isFiltered = activeFilters[col] !== undefined;
    filterBtn.className = isFiltered ? "excel-filter-btn filtered" : "excel-filter-btn";
    filterBtn.innerHTML = "▼";
    filterBtn.title = `Filter ${col}`;

    filterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openColumnFilter(col);
    });

    wrapper.appendChild(titleSpan);
    wrapper.appendChild(filterBtn);
    th.appendChild(wrapper);
    tr.appendChild(th);
  });

  const thAction = document.createElement("th");
  thAction.className = "excel-th";
  thAction.innerText = "ACTION";
  tr.appendChild(thAction);

  thead.appendChild(tr);
}

// ફિલ્ટર મુજબ ડેટા રો બતાવો
function renderRows() {
  filteredData = rawData.filter((row) => {
    return Object.keys(activeFilters).every((col) => {
      const allowedSet = activeFilters[col];
      if (!allowedSet) return true;
      return allowedSet.has(getDisplayVal(row[col]));
    });
  });

  document.getElementById("record-count").innerText = filteredData.length;
  tbody.innerHTML = "";

  if (filteredData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${currentColumns.length + 1}">કોઈ ડેટા મળ્યો નથી.</td></tr>`;
    return;
  }

  filteredData.forEach((row) => {
    const tr = document.createElement("tr");

    currentColumns.forEach((col) => {
      const td = document.createElement("td");
      td.innerText = row[col] !== null && row[col] !== undefined ? row[col] : "-";
      tr.appendChild(td);
    });

    const tdAction = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "mini-btn";
    editBtn.innerText = "✏️ Edit";
    editBtn.addEventListener("click", () => openEditModal(row));
    tdAction.appendChild(editBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });
}

function applyFiltersAndRender() {
  buildHeader();
  renderRows();
}

// સ્ક્રીનશોટ મુજબનું Excel Filter Popup ખોલો
const filterOverlay = document.getElementById("filter-dropdown-overlay");
const filterSearchInput = document.getElementById("filter-search-input");
const filterSelectAll = document.getElementById("filter-select-all");
const filterOptionsList = document.getElementById("filter-options-list");

function openColumnFilter(col) {
  currentFilterCol = col;
  const colTitle = col.toUpperCase().replace(/_/g, " ");
  filterSearchInput.placeholder = `Search in ${colTitle}...`;
  filterSearchInput.value = "";

  // આ કોલમની બધી યુનિક વેલ્યુ અને તેની ગણતરી (Count) શોધો
  const counts = {};
  rawData.forEach((row) => {
    const val = getDisplayVal(row[col]);
    counts[val] = (counts[val] || 0) + 1;
  });

  const uniqueVals = Object.keys(counts).sort();
  const existingSet = activeFilters[col];

  filterOptionsList.innerHTML = "";
  uniqueVals.forEach((val) => {
    const label = document.createElement("label");
    label.className = "filter-item-row filter-value-item";
    label.dataset.val = val.toLowerCase();

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = val;
    cb.checked = existingSet ? existingSet.has(val) : true;

    cb.addEventListener("change", updateSelectAllState);

    const textSpan = document.createElement("span");
    textSpan.innerHTML = `${val} <span style="color:#64748b;">(${counts[val]})</span>`;

    label.appendChild(cb);
    label.appendChild(textSpan);
    filterOptionsList.appendChild(label);
  });

  updateSelectAllState();
  filterOverlay.style.display = "flex";
}

function updateSelectAllState() {
  const visibleCheckboxes = Array.from(
    filterOptionsList.querySelectorAll(".filter-value-item:not([style*='display: none']) input[type='checkbox']")
  );
  filterSelectAll.checked = visibleCheckboxes.length > 0 && visibleCheckboxes.every((cb) => cb.checked);
}

// Search બોક્સમાં લખતા લિસ્ટ ફિલ્ટર કરો
filterSearchInput.addEventListener("input", () => {
  const term = filterSearchInput.value.toLowerCase().trim();
  const items = filterOptionsList.querySelectorAll(".filter-value-item");
  items.forEach((item) => {
    item.style.display = item.dataset.val.includes(term) ? "flex" : "none";
  });
  updateSelectAllState();
});

// (Select All) ચેકબોક્સ
filterSelectAll.addEventListener("change", () => {
  const isChecked = filterSelectAll.checked;
  const visibleCheckboxes = filterOptionsList.querySelectorAll(
    ".filter-value-item:not([style*='display: none']) input[type='checkbox']"
  );
  visibleCheckboxes.forEach((cb) => (cb.checked = isChecked));
});

// OK બટન દબાવતા ફિલ્ટર લાગુ કરો
document.getElementById("filter-ok-btn").addEventListener("click", () => {
  const allCheckboxes = Array.from(filterOptionsList.querySelectorAll("input[type='checkbox']"));
  const checkedVals = allCheckboxes.filter((cb) => cb.checked).map((cb) => cb.value);

  if (checkedVals.length === allCheckboxes.length) {
    delete activeFilters[currentFilterCol]; // બધા સિલેક્ટ હોય તો ફિલ્ટર હટાવો
  } else {
    activeFilters[currentFilterCol] = new Set(checkedVals);
  }

  filterOverlay.style.display = "none";
  applyFiltersAndRender();
});

// Clear બટન (ફક્ત આ કોલમનું ફિલ્ટર હટાવવા)
document.getElementById("filter-clear-btn").addEventListener("click", () => {
  delete activeFilters[currentFilterCol];
  filterOverlay.style.display = "none";
  applyFiltersAndRender();
});

// બહાર ક્લિક કરવાથી ફિલ્ટર બોક્સ બંધ થાય
filterOverlay.addEventListener("click", (e) => {
  if (e.target === filterOverlay) {
    filterOverlay.style.display = "none";
  }
});

// ઉપરનું 'Clear Filters' બટન (બધી કોલમના ફિલ્ટર એકસાથે સાફ કરવા)
document.getElementById("btn-clear-all-filters").addEventListener("click", () => {
  activeFilters = {};
  applyFiltersAndRender();
});

// Full Data અને Custom Data બટન
document.getElementById("btn-full-data").addEventListener("click", () => {
  currentColumns = fullColumns;
  currentViewName = "Full_Data";
  viewTitle.innerText = "Full Data View (All Columns)";
  applyFiltersAndRender();
});

document.getElementById("btn-custom-data").addEventListener("click", () => {
  currentColumns = customColumns;
  currentViewName = "Custom_Data";
  viewTitle.innerText = "Custom Data View (Selected Columns)";
  applyFiltersAndRender();
});

// Filtered Data ને Excel માં ડાઉનલોડ કરો
document.getElementById("btn-download-excel").addEventListener("click", () => {
  if (filteredData.length === 0) {
    alert("ડાઉનલોડ કરવા માટે ટેબલમાં કોઈ ડેટા નથી!");
    return;
  }

  const exportRows = filteredData.map((row) => {
    const obj = {};
    currentColumns.forEach((col) => {
      obj[col] = row[col] !== null ? row[col] : "";
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, currentViewName);

  const fileName = `NSE_${currentViewName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
});

// Edit અને Delete Modal લોજિક
const editModal = document.getElementById("edit-modal");
const editFieldsContainer = document.getElementById("edit-fields-container");

function openEditModal(row) {
  editingSrNo = row.sr_no;
  document.getElementById("modal-title").innerText = `Edit Record (Sr No: ${row.sr_no})`;
  editFieldsContainer.innerHTML = "";

  fullColumns.forEach((col) => {
    if (col === "sr_no") return;

    const label = document.createElement("label");
    label.innerText = col.toUpperCase().replace(/_/g, " ") + ":";
    label.style.display = "block";
    label.style.marginTop = "10px";
    label.style.fontWeight = "600";
    label.style.fontSize = "13px";

    const input = document.createElement("input");
    input.id = `edit_${col}`;
    input.value = row[col] !== null && row[col] !== undefined ? row[col] : "";
    input.style.width = "100%";
    input.style.padding = "8px";
    input.style.marginTop = "4px";
    input.style.border = "1px solid #cbd5e1";
    input.style.borderRadius = "5px";
    input.style.boxSizing = "border-box";

    if (col === "date") input.type = "date";
    else if (col === "stock_name") input.type = "text";
    else {
      input.type = "number";
      input.step = "any";
    }

    editFieldsContainer.appendChild(label);
    editFieldsContainer.appendChild(input);
  });

  editModal.style.display = "flex";
}

document.getElementById("close-modal-btn").addEventListener("click", () => {
  editModal.style.display = "none";
});

document.getElementById("save-edit-btn").addEventListener("click", async () => {
  if (!editingSrNo) return;

  const updatedPayload = {};
  fullColumns.forEach((col) => {
    if (col === "sr_no") return;
    const val = document.getElementById(`edit_${col}`).value.trim();

    if (val === "") updatedPayload[col] = null;
    else if (col === "date") updatedPayload[col] = val;
    else if (col === "stock_name") updatedPayload[col] = val.toUpperCase();
    else updatedPayload[col] = parseFloat(val);
  });

  const { error } = await supabaseClient
    .from("task_nse")
    .update(updatedPayload)
    .eq("sr_no", editingSrNo);

  if (error) {
    alert("અપડેટ કરવામાં એરર આવી: " + error.message);
  } else {
    alert("ડેટા સફળતાપૂર્વક અપડેટ થઈ ગયો!");
    editModal.style.display = "none";
    loadDatabase();
  }
});

document.getElementById("delete-row-btn").addEventListener("click", async () => {
  if (!editingSrNo) return;

  if (!confirm(`શું તમે ખરેખર Sr No: ${editingSrNo} વાળો રેકોર્ડ ડિલીટ કરવા માંગો છો?`)) return;

  const { error } = await supabaseClient
    .from("task_nse")
    .delete()
    .eq("sr_no", editingSrNo);

  if (error) {
    alert("ડિલીટ કરવામાં એરર આવી: " + error.message);
  } else {
    alert("રેકોર્ડ સફળતાપૂર્વક ડિલીટ થઈ ગયો!");
    editModal.style.display = "none";
    loadDatabase();
  }
});

loadDatabase();
