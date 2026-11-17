// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentOpeningBalance = 10000;
let currentNetPL = 0;
let currentClosingBalance = 10000;
let nextSettlementNumber = 1;

const savingInput = document.getElementById("input_for_saving");
const taskInput = document.getElementById("input_for_task");

// Live Actually Closing ગણતરી (Closing - Saving - Task)
function updateActuallyClosingPreview() {
  const saving = parseFloat(savingInput.value) || 0;
  const forTask = parseFloat(taskInput.value) || 0;
  const actuallyClosing = currentClosingBalance - saving - forTask;
  document.getElementById("disp_actually_closing").innerText = `₹${actuallyClosing.toFixed(2)}`;
}

savingInput.addEventListener("input", updateActuallyClosingPreview);
taskInput.addEventListener("input", updateActuallyClosingPreview);

// બાકી રહેલા અને પૂર્ણ થયેલા સેટલમેન્ટ લોડ કરો
async function loadPendingSettlements() {
  const pendingList = document.getElementById("pending-settlement-list");
  const completedTbody = document.getElementById("completed-settlement-tbody");
  const formBox = document.getElementById("settlement-form-box");

  pendingList.innerHTML = "લોડ થઈ રહ્યું છે...";
  completedTbody.innerHTML = '<tr><td colspan="9">લોડ થઈ રહ્યું છે...</td></tr>';
  formBox.style.display = "none";

  const { data: allRows, error } = await supabaseClient
    .from("task_nse")
    .select("*")
    .order("sr_no", { ascending: true });

  if (error) {
    pendingList.innerHTML = `<span style="color:red;">એરર: ${error.message}</span>`;
    return;
  }

  const settledRows = (allRows || [])
    .filter((r) => r.sattelment !== null)
    .sort((a, b) => Number(b.sattelment) - Number(a.sattelment));

  // છેલ્લા સેટલમેન્ટનું actually_closing એ નવું opening_balance બનશે
  if (settledRows.length > 0) {
    nextSettlementNumber = Number(settledRows[0].sattelment) + 1;
    const lastSettled = settledRows[0];
    currentOpeningBalance =
      lastSettled.actually_closing !== null && lastSettled.actually_closing !== undefined
        ? parseFloat(lastSettled.actually_closing)
        : parseFloat(lastSettled.closing_balance) || 10000;
  } else {
    nextSettlementNumber = 1;
    currentOpeningBalance = 10000;
  }

  // Completed ટેબલ ભરો
  if (settledRows.length === 0) {
    completedTbody.innerHTML = '<tr><td colspan="9">હજુ સુધી કોઈ Sattelment થયું નથી.</td></tr>';
  } else {
    completedTbody.innerHTML = "";
    settledRows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${r.sattelment}</strong></td>
        <td>${r.date || "-"}</td>
        <td>${r.stock_name || "-"}</td>
        <td>₹${Number(r.opening_balance || 0).toFixed(2)}</td>
        <td style="color:${Number(r.net_profit_loss) >= 0 ? '#15803d' : '#dc2626'}; font-weight:bold;">₹${Number(r.net_profit_loss || 0).toFixed(2)}</td>
        <td>₹${Number(r.closing_balance || 0).toFixed(2)}</td>
        <td>₹${Number(r.for_saving || 0).toFixed(2)}</td>
        <td>₹${Number(r.for_task || 0).toFixed(2)}</td>
        <td><strong>₹${Number(r.actually_closing ?? r.closing_balance ?? 0).toFixed(2)}</strong></td>
      `;
      completedTbody.appendChild(tr);
    });
  }

  // એવા ટ્રેડ લાવો જે પૂર્ણ થઈ ગયા છે (buy અને sell બંને ભરાયેલા છે) પણ sattelment બાકી છે
  const pendingTrades = (allRows || []).filter(
    (r) => r.sattelment === null && r.buy_price !== null && r.sell_price !== null
  );

  if (pendingTrades.length === 0) {
    pendingList.innerHTML = "<p>કોઈ Sattelment બાકી નથી.</p>";
    return;
  }

  pendingList.innerHTML = "";
  pendingTrades.forEach((trade, index) => {
    const netPL = parseFloat(trade.net_profit_loss) || 0;
    const div = document.createElement("div");
    div.className = "pending-item";
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";

    div.innerHTML = `
      <div>
        <strong>${trade.date} — ${trade.stock_name}</strong><br/>
        <span style="font-size:13px;">Net P/L: <strong style="color:${netPL >= 0 ? '#15803d' : '#dc2626'};">₹${netPL.toFixed(2)}</strong></span>
      </div>
      <button type="button" class="action-btn" style="padding: 8px 14px; font-size: 13px;">Sattelment</button>
    `;

    div.querySelector("button").addEventListener("click", () => {
      if (index !== 0) {
        alert("કૃપા કરીને પહેલા સૌથી જૂના બાકી ટ્રેડનું Sattelment કરો!");
        return;
      }

      currentNetPL = netPL;
      currentClosingBalance = currentOpeningBalance + currentNetPL;

      document.getElementById("settle_sr_no").value = trade.sr_no;
      document.getElementById("settle_no").value = nextSettlementNumber;
      document.getElementById("settle-trade-title").innerText = `Sattelment #${nextSettlementNumber} — ${trade.stock_name} (${trade.date})`;

      document.getElementById("disp_opening_bal").innerText = `₹${currentOpeningBalance.toFixed(2)}`;
      const plEl = document.getElementById("disp_net_pl");
      plEl.innerText = `${currentNetPL >= 0 ? "+" : ""}₹${currentNetPL.toFixed(2)}`;
      plEl.style.color = currentNetPL >= 0 ? "#15803d" : "#dc2626";

      document.getElementById("disp_closing_bal").innerText = `₹${currentClosingBalance.toFixed(2)}`;

      savingInput.value = "0";
      taskInput.value = "0";
      updateActuallyClosingPreview();

      formBox.style.display = "block";
    });

    pendingList.appendChild(div);
  });
}

// Sattelment સેવ કરો
document.getElementById("confirm-settlement-btn").addEventListener("click", async () => {
  const srNo = document.getElementById("settle_sr_no").value;
  const settleNo = Number(document.getElementById("settle_no").value);
  const forSaving = parseFloat(savingInput.value) || 0;
  const forTask = parseFloat(taskInput.value) || 0;

  if (forSaving < 0 || forTask < 0) {
    alert("Saving અને Task ની રકમ 0 અથવા તેનાથી વધુ હોવી જોઈએ!");
    return;
  }

  const actuallyClosing = currentClosingBalance - forSaving - forTask;

  const { error } = await supabaseClient
    .from("task_nse")
    .update({
      sattelment: settleNo,
      opening_balance: currentOpeningBalance,
      closing_balance: currentClosingBalance,
      for_saving: forSaving,
      for_task: forTask,
      actually_closing: actuallyClosing
    })
    .eq("sr_no", srNo);

  if (error) {
    alert("Sattelment સેવ કરવામાં એરર આવી: " + error.message);
  } else {
    alert(
      `Sattelment #${settleNo} પૂર્ણ થયું!\n` +
      `Closing Balance: ₹${currentClosingBalance.toFixed(2)}\n` +
      `For Saving: ₹${forSaving.toFixed(2)}\n` +
      `For Task: ₹${forTask.toFixed(2)}\n` +
      `Actually Closing: ₹${actuallyClosing.toFixed(2)}`
    );
    await loadPendingSettlements();
  }
});

loadPendingSettlements();
