// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let allTasks = [];
let completedTasks = [];
let activeTasks = [];

const tableHead = document.getElementById("table-head");
const tableBody = document.getElementById("table-body");
const reportTitle = document.getElementById("report-title");

// પેજ ખુલતા જ Supabase માંથી બધો ડેટા લોડ કરો
async function fetchReportData() {
  const { data, error } = await supabaseClient
    .from("task_nse")
    .select("*")
    .order("sr_no", { ascending: false });

  if (error) {
    tableBody.innerHTML = `<tr><td style="color:red;">એરર આવી: ${error.message}</td></tr>`;
    return;
  }

  allTasks = data;

  // Completed task: જ્યાં sell_price, sell_qty અને sell_charges ભરેલા હોય
  completedTasks = data.filter(
    (row) => row.sell_price !== null && row.sell_qty !== null && row.sell_charges !== null
  );

  // Active task: જ્યાં sell_price, sell_qty અથવા sell_charges ખાલી હોય
  activeTasks = data.filter(
    (row) => row.sell_price === null || row.sell_qty === null || row.sell_charges === null
  );

  // બટનો પર સંખ્યા (Count) અપડેટ કરો
  document.getElementById("count-all").innerText = allTasks.length;
  document.getElementById("count-completed").innerText = completedTasks.length;
  document.getElementById("count-active").innerText = activeTasks.length;

  // શરૂઆતમાં All Task બતાવો
  renderTable(allTasks, "All Tasks (Completed + Active)", true);
}

// ટેબલ બનાવવાનું ફંક્શન (showSellColumns = true હોય તો Sell ની કોલમ પણ બતાવશે)
function renderTable(rows, title, showSellColumns) {
  reportTitle.innerText = title;

  if (rows.length === 0) {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "<tr><td>આ વિભાગમાં કોઈ ડેટા ઉપલબ્ધ નથી.</td></tr>";
    return;
  }

  // હેડર કોલમ નક્કી કરો
  if (showSellColumns) {
    tableHead.innerHTML = `
      <tr>
        <th>Sr No</th>
        <th>Date</th>
        <th>Stock Name</th>
        <th>Buy Price</th>
        <th>Buy Qty</th>
        <th>Buy Charges</th>
        <th>Sell Price</th>
        <th>Sell Qty</th>
        <th>Sell Charges</th>
        <th>Net P/L</th>
      </tr>
    `;
  } else {
    // Active Task માટે ફક્ત Buy સુધીની કોલમ
    tableHead.innerHTML = `
      <tr>
        <th>Sr No</th>
        <th>Date</th>
        <th>Stock Name</th>
        <th>Buy Price</th>
        <th>Buy Qty</th>
        <th>Buy Charges</th>
      </tr>
    `;
  }

  // દરેક રો (Row) ટેબલમાં ઉમેરો
  tableBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");

    if (showSellColumns) {
      const netPL = row.net_profit_loss !== null ? `₹${Number(row.net_profit_loss).toFixed(2)}` : "-";
      const plColor = row.net_profit_loss > 0 ? "green" : row.net_profit_loss < 0 ? "red" : "black";

      tr.innerHTML = `
        <td>${row.sr_no}</td>
        <td>${row.date || "-"}</td>
        <td><strong>${row.stock_name || "-"}</strong></td>
        <td>${row.buy_price ?? "-"}</td>
        <td>${row.buy_qty ?? "-"}</td>
        <td>${row.buy_charges ?? "-"}</td>
        <td>${row.sell_price ?? "-"}</td>
        <td>${row.sell_qty ?? "-"}</td>
        <td>${row.sell_charges ?? "-"}</td>
        <td style="color:${plColor}; font-weight:bold;">${netPL}</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${row.sr_no}</td>
        <td>${row.date || "-"}</td>
        <td><strong>${row.stock_name || "-"}</strong></td>
        <td>${row.buy_price ?? "-"}</td>
        <td>${row.buy_qty ?? "-"}</td>
        <td>${row.buy_charges ?? "-"}</td>
      `;
    }

    tableBody.appendChild(tr);
  });
}

// ત્રણેય બટનોની ક્લિક ઇવેન્ટ
document.getElementById("btn-all").addEventListener("click", () => {
  renderTable(allTasks, "All Tasks (Completed + Active)", true);
});

document.getElementById("btn-completed").addEventListener("click", () => {
  renderTable(completedTasks, "Completed Tasks", true);
});

document.getElementById("btn-active").addEventListener("click", () => {
  renderTable(activeTasks, "Active Tasks (Pending Sell)", false);
});

// પેજ લોડ થતા ડેટા મંગાવો
fetchReportData();
