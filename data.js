// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Full Data માટેની બધી જ કોલમ
const fullColumns = [
  "sr_no", "date", "stock_name", "buy_price", "buy_qty", "buy_charges",
  "sell_price", "sell_qty", "sell_charges", "buy_amount", "sell_amount",
  "total_trn_amount", "total_charges", "gross_profit_loss", "net_profit_loss",
  "opening_balance", "closing_balance", "for_saving", "for_task"
];

// Custom Data માટેની 8 કોલમ
const customColumns = [
  "sr_no", "date", "stock_name", "buy_price", "sell_price",
  "net_profit_loss", "opening_balance", "closing_balance"
];

let rawData = [];
let filteredData = [];
let currentColumns = fullColumns;
let currentViewName = "Full_Data";
let filters = {};
let editingSrNo = null;

const thead = document.getElementById("data-thead");
const tbody = document.getElementById("data-tbody");
const viewTitle = document.getElementById("view-title");

// Supabase માંથી બધો ડેટા લાવો
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

// હેડર અને ફિલ્ટર ઇનપુટ બોક્સ બનાવો
function buildHeader() {
  thead.innerHTML = "";

  // 1. કોલમ નામની લાઇન
  const trTitle = document.createElement("tr");
  currentColumns.forEach((col) => {
    const th = document.createElement("th");
    th.innerText = col.toUpperCase().replace(/_/g, " ");
    trTitle.appendChild(th);
  });
  const thAction = document.createElement("th");
  thAction.innerText = "ACTION";
  trTitle.appendChild(thAction);
  thead.appendChild(trTitle);

  // 2. દરેક કોલમની નીચે ફિલ્ટર બોક્સની લાઇન
  const trFilter = document.createElement("tr");
  currentColumns.forEach((col) => {
    const th = document.createElement("th");
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Filter...";
    input.className = "col-filter-input";
    input.value = filters[col] || "";

    input.addEventListener("input", (e) => {
      filters[col] = e.target.value.toLowerCase().trim();
      renderRowsOnly();
    });

    th.appendChild(input);
    trFilter.appendChild(th);
  });

  const thEmpty = document.createElement("th");
  thEmpty.innerHTML = `<button type="button" id="clear-filter-btn" class="mini-btn" style="background:#64748b;">Clear</button>`;
  trFilter.appendChild(thEmpty);
  thead.appendChild(trFilter);

  document.getElementById("clear-filter-btn").addEventListener("click", () => {
    filters = {};
    buildHeader();
    renderRowsOnly();
  });
}

// ફિલ્ટર મુજબ ફક્ત ડેટા રો (Rows) બતાવો
function renderRowsOnly() {
  filteredData = rawData.filter((row) => {
    return currentColumns.every((col) => {
      const searchVal = filters[col];
      if (!searchVal) return true;
      const cellVal = row[col] !== null && row[col] !== undefined ? String(row[col]).toLowerCase() : "";
      return cellVal.includes(searchVal);
    });
  });

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

    // Edit બટન
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
  renderRowsOnly();
}

// 1) Full Data બટન
document.getElementById("btn-full-data").addEventListener("click", () => {
  currentColumns = fullColumns;
  currentViewName = "Full_Data";
  viewTitle.innerText = "Full Data View (All Columns)";
  applyFiltersAndRender();
});

// 2) Custom Data બટન
document.getElementById("btn-custom-data").addEventListener("click", () => {
  currentColumns = customColumns;
  currentViewName = "Custom_Data";
  viewTitle.innerText = "Custom Data View (Selected Columns)";
  applyFiltersAndRender();
});

// 3) Filtered Data ને Excel (.xlsx) માં ડાઉનલોડ કરો
document.getElementById("btn-download-excel").addEventListener("click", () => {
  if (filteredData.length === 0) {
    alert("ડાઉનલોડ કરવા માટે ટેબલમાં કોઈ ડેટા નથી!");
    return;
  }

  // ફક્ત હાલના View ની કોલમ અને ફિલ્ટર થયેલો ડેટા જ Excel માં લો
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

// 4) Edit Modal ખોલો
const editModal = document.getElementById("edit-modal");
const editFieldsContainer = document.getElementById("edit-fields-container");

function openEditModal(row) {
  editingSrNo = row.sr_no;
  document.getElementById("modal-title").innerText = `Edit Record (Sr No: ${row.sr_no})`;
  editFieldsContainer.innerHTML = "";

  // sr_no સિવાયની બધી જ કોલમ એડિટ કરવા માટે બતાવો
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

    if (col === "date") {
      input.type = "date";
    } else if (col === "stock_name") {
      input.type = "text";
    } else {
      input.type = "number";
      input.step = "any";
    }

    editFieldsContainer.appendChild(label);
    editFieldsContainer.appendChild(input);
  });

  editModal.style.display = "flex";
}

// Modal બંધ કરો
document.getElementById("close-modal-btn").addEventListener("click", () => {
  editModal.style.display = "none";
});

// Edit કરેલો ડેટા Supabase માં Save કરો
document.getElementById("save-edit-btn").addEventListener("click", async () => {
  if (!editingSrNo) return;

  const updatedPayload = {};
  fullColumns.forEach((col) => {
    if (col === "sr_no") return;
    const val = document.getElementById(`edit_${col}`).value.trim();

    if (val === "") {
      updatedPayload[col] = null;
    } else if (col === "date") {
      updatedPayload[col] = val;
    } else if (col === "stock_name") {
      updatedPayload[col] = val.toUpperCase();
    } else {
      updatedPayload[col] = parseFloat(val);
    }
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

// Edit Modal માંથી Row Delete કરો
document.getElementById("delete-row-btn").addEventListener("click", async () => {
  if (!editingSrNo) return;

  const confirmDelete = confirm(`શું તમે ખરેખર Sr No: ${editingSrNo} વાળો રેકોર્ડ ડિલીટ કરવા માંગો છો?`);
  if (!confirmDelete) return;

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

// પેજ ખુલતા ડેટા લોડ કરો
loadDatabase();
