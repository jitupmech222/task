// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const fromDateInput = document.getElementById("from_date");
const uptoDateInput = document.getElementById("upto_date");
const tbody = document.getElementById("pl-report-tbody");
const tfoot = document.getElementById("pl-report-tfoot");

let currentSummaryRows = [];

// પેજ ખુલતા ચાલુ મહિનાની પહેલી તારીખથી આજની તારીખ ઓટો સેટ કરો
function setDefaultDates() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  fromDateInput.value = `${yyyy}-${mm}-01`;
  uptoDateInput.value = `${yyyy}-${mm}-${dd}`;
}

// તારીખ મુજબ P/L ફિલ્ટર અને ગણતરી કરો
async function generatePLReport() {
  const fromDate = fromDateInput.value;
  const uptoDate = uptoDateInput.value;

  if (!fromDate || !uptoDate) {
    alert("કૃપા કરીને From Date અને Upto Date બંને પસંદ કરો!");
    return;
  }

  if (fromDate > uptoDate) {
    alert("From Date એ Upto Date કરતાં નાની હોવી જોઈએ!");
    return;
  }

  tbody.innerHTML = '<tr><td colspan="3">ડેટા ગણતરી થઈ રહ્યો છે...</td></tr>';
  tfoot.style.display = "none";
  document.getElementById("report-range-title").innerText = `P/L Report (${fromDate} to ${uptoDate})`;

  // task_nse ટેબલમાંથી પસંદ કરેલી તારીખો વચ્ચેના અને જેનું net_profit_loss ભરેલું હોય તેવા રેકોર્ડ લાવો
  const { data, error } = await supabaseClient
    .from("task_nse")
    .select("date, net_profit_loss")
    .gte("date", fromDate)
    .lte("date", uptoDate)
    .not("net_profit_loss", "is", null)
    .order("date", { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:red;">એરર આવી: ${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    currentSummaryRows = [];
    tbody.innerHTML = '<tr><td colspan="3">આ તારીખો વચ્ચે કોઈ પૂર્ણ થયેલો ટ્રેડ મળ્યો નથી.</td></tr>';
    return;
  }

  // એક જ તારીખના બધા ટ્રેડનું net_profit_loss ભેગું (Group by Date) કરો
  const dateMap = {};
  data.forEach((row) => {
    const dt = row.date || "Unknown";
    const pl = parseFloat(row.net_profit_loss) || 0;

    if (!dateMap[dt]) {
      dateMap[dt] = { date: dt, trades: 0, netPL: 0 };
    }
    dateMap[dt].trades += 1;
    dateMap[dt].netPL += pl;
  });

  currentSummaryRows = Object.values(dateMap);

  tbody.innerHTML = "";
  let grandTotalTrades = 0;
  let grandTotalPL = 0;

  currentSummaryRows.forEach((item) => {
    grandTotalTrades += item.trades;
    grandTotalPL += item.netPL;

    const plColor = item.netPL >= 0 ? "#15803d" : "#dc2626";
    const plPrefix = item.netPL > 0 ? "+" : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${item.date}</strong></td>
      <td>${item.trades}</td>
      <td style="color: ${plColor}; font-weight: bold;">${plPrefix}₹${item.netPL.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  // સૌથી નીચે Total Summary અપડેટ કરો
  const totalColor = grandTotalPL >= 0 ? "#15803d" : "#dc2626";
  const totalPrefix = grandTotalPL > 0 ? "+" : "";

  document.getElementById("summary-total-trades").innerText = grandTotalTrades;
  const summaryPlCell = document.getElementById("summary-total-pl");
  summaryPlCell.innerText = `${totalPrefix}₹${grandTotalPL.toFixed(2)}`;
  summaryPlCell.style.color = totalColor;

  tfoot.style.display = "table-footer-group";
}

// Show P/L બટન
document.getElementById("btn-show-pl").addEventListener("click", generatePLReport);

// Excel ડાઉનલોડ બટન
document.getElementById("btn-export-pl").addEventListener("click", () => {
  if (currentSummaryRows.length === 0) {
    alert("ડાઉનલોડ કરવા માટે કોઈ ડેટા નથી!");
    return;
  }

  const exportData = currentSummaryRows.map((r) => ({
    Date: r.date,
    Total_Trades: r.trades,
    Net_Profit_Loss: Number(r.netPL.toFixed(2))
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PL_Report");
  XLSX.writeFile(wb, `NSE_PL_Report_${fromDateInput.value}_to_${uptoDateInput.value}.xlsx`);
});

// પેજ લોડ થતા ડિફોલ્ટ તારીખ સેટ કરીને રિપોર્ટ બતાવો
setDefaultDates();
generatePLReport();
