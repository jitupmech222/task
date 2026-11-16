// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// SAHI બ્રોકરેજ અને ટેક્સ ગણતરી (PDF B-1 થી B-5 મુજબ 100% ચોક્કસ)
function calculateSahiCharges(segment, side, price, qty) {
  const turnover = price * qty;
  if (isNaN(turnover) || turnover <= 0) return 0;

  let brokerage = 0;
  let stt = 0;
  let exch = 0;
  let sebi = turnover * 0.000001;
  let stamp = 0;

  if (segment === "INTRADAY") {
    brokerage = Math.min(10, turnover * 0.0005);
    stt = side === "SELL" ? turnover * 0.00025 : 0;
    exch = turnover * 0.0000307;
    stamp = side === "BUY" ? Math.ceil(turnover * 0.00003) : 0;
  } else if (segment === "OPTIONS") {
    brokerage = 10;
    stt = side === "SELL" ? turnover * 0.0015 : 0;
    exch = turnover * 0.0003553;
    stamp = side === "BUY" ? Math.ceil(turnover * 0.00003) : 0;
  } else if (segment === "MCX_OPTIONS") {
    brokerage = 10;
    stt = side === "SELL" ? turnover * 0.0005 : 0;
    exch = turnover * 0.000418;
    stamp = side === "BUY" ? Math.ceil(turnover * 0.00003) : 0;
  }

  const gst = (brokerage + exch + sebi) * 0.18;
  const total = brokerage + stt + exch + sebi + stamp + gst;
  return Number(total.toFixed(2));
}

let lastSettledSrNo = null;
let currentClosingBalance = 0;
let amountForTask = 0;
let nextTaskNumber = 1;
let activeTasksList = [];

const loadingMsg = document.getElementById("loading-msg");
const pendingWarning = document.getElementById("pending-warning");
const taskGeneratorArea = document.getElementById("task-generator-area");
const playTaskCard = document.getElementById("play-task-card");

function calculateTaskLevel(amount) {
  if (amount <= 5) return 0;
  if (amount < 20) return 1;
  return Math.floor(Math.log2(amount / 10)) + 1;
}

// 1. પેજ લોડ થતા શરતો ચેક કરો
async function initializePage() {
  try {
    loadingMsg.style.display = "block";
    loadingMsg.innerText = "ચેક થઈ રહ્યું છે...";
    pendingWarning.style.display = "none";
    taskGeneratorArea.style.display = "none";

    const { data: allTrades, error } = await supabaseClient
      .from("task_nse")
      .select("*")
      .order("sattelment", { ascending: false });

    if (error) {
      loadingMsg.innerHTML = `<span style="color:red;">ડેટાબેઝ એરર: ${error.message}</span>`;
      return;
    }

    loadingMsg.style.display = "none";

    if (!allTrades || allTrades.length === 0) {
      pendingWarning.innerText = "⚠️ હજુ સુધી કોઈ ટ્રેડ એન્ટ્રી થઈ નથી.";
      pendingWarning.style.display = "block";
      return;
    }

    const hasIncompleteSettlement = allTrades.some(
      (row) => row.sattelment === null || row.opening_balance === null || row.closing_balance === null
    );

    if (hasIncompleteSettlement) {
      pendingWarning.style.display = "block";
      return;
    }

    const latestSettledRow = allTrades[0];
    lastSettledSrNo = latestSettledRow.sr_no;
    currentClosingBalance = parseFloat(latestSettledRow.closing_balance) || 0;
    amountForTask = currentClosingBalance - 10000;

    document.getElementById("display-closing-bal").innerText = `₹${currentClosingBalance.toFixed(2)}`;
    document.getElementById("display-task-available").innerText = `₹${amountForTask.toFixed(2)}`;

    taskGeneratorArea.style.display = "block";
    playTaskCard.style.display = "block";

    await loadNseTasks();
  } catch (err) {
    loadingMsg.innerHTML = `<span style="color:red;">સિસ્ટમ એરર: ${err.message}</span>`;
  }
}

// 2. nse_task ટેબલ લોડ કરો
async function loadNseTasks() {
  const tbody = document.getElementById("nse-task-tbody");
  const selectDropdown = document.getElementById("select_active_task");

  try {
    const { data: tasks, error } = await supabaseClient
      .from("nse_task")
      .select("*")
      .order("task_number", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:red;">એરર: ${error.message}</td></tr>`;
      return;
    }

    const { data: openTrades } = await supabaseClient
      .from("nse_task_trades")
      .select("task_number")
      .or("buy_price.is.null,sell_price.is.null");

    const inProgressTaskNumbers = new Set(
      (openTrades || []).map((tr) => Number(tr.task_number))
    );

    activeTasksList = [];
    selectDropdown.innerHTML = "";

    if (!tasks || tasks.length === 0) {
      nextTaskNumber = 1;
      tbody.innerHTML = '<tr><td colspan="4">હજુ સુધી કોઈ ટાસ્ક બન્યો નથી.</td></tr>';
    } else {
      nextTaskNumber = Number(tasks[0].task_number) + 1;
      tbody.innerHTML = "";

      tasks.forEach((t) => {
        const amt = Number(t.task_amount);
        const lvl = calculateTaskLevel(amt);
        const isCurrentlyPlaying = inProgressTaskNumbers.has(Number(t.task_number));

        let displayStatus = t.status || (amt <= 5 ? "Closed" : "Active");
        if (displayStatus !== "Closed" && isCurrentlyPlaying) {
          displayStatus = "In Progress";
        }

        let statusBadge = "";
        if (displayStatus === "Closed") {
          statusBadge = `<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:4px; font-weight:bold;">Closed</span>`;
        } else if (displayStatus === "In Progress") {
          statusBadge = `<span style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:4px; font-weight:bold;">In Progress</span>`;
        } else {
          statusBadge = `<span style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:4px; font-weight:bold;">Active</span>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>Task ${t.task_number}</strong></td>
          <td>₹${amt.toFixed(2)}</td>
          <td><strong>Level ${lvl}</strong></td>
          <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);

        if (displayStatus === "Active") {
          activeTasksList.push(t);
          const opt = document.createElement("option");
          opt.value = t.task_number;
          opt.innerText = `Task ${t.task_number} — Amount: ₹${amt.toFixed(2)} (Level ${lvl})`;
          selectDropdown.appendChild(opt);
        }
      });
    }

    if (activeTasksList.length === 0) {
      selectDropdown.innerHTML = '<option value="">કોઈ Active Task ઉપલબ્ધ નથી</option>';
    }

    document.getElementById("auto_task_number").value = nextTaskNumber;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:red;">એરર: ${err.message}</td></tr>`;
  }
}

document.getElementById("show-create-form-btn").addEventListener("click", () => {
  document.getElementById("create-task-form").style.display = "block";
  document.getElementById("auto_task_number").value = nextTaskNumber;
});

document.getElementById("save-task-btn").addEventListener("click", async () => {
  const taskAmount = parseFloat(document.getElementById("input_task_amount").value);

  if (isNaN(taskAmount) || taskAmount <= 5) {
    alert("ટાસ્ક શરૂ કરવા માટે ₹5 થી વધુ રકમ દાખલ કરો!");
    return;
  }

  if (taskAmount > amountForTask) {
    alert(`તમારી પાસે ટાસ્ક માટે ફક્ત ₹${amountForTask.toFixed(2)} ઉપલબ્ધ છે!`);
    return;
  }

  const initialLevel = calculateTaskLevel(taskAmount);

  const { error: insertErr } = await supabaseClient
    .from("nse_task")
    .insert([
      {
        task_number: nextTaskNumber,
        task_amount: taskAmount,
        task_level: initialLevel,
        status: "Active"
      }
    ]);

  if (insertErr) {
    alert("ટાસ્ક સેવ કરવામાં એરર આવી: " + insertErr.message);
    return;
  }

  const updatedClosingBalance = currentClosingBalance - taskAmount;

  const { error: updateErr } = await supabaseClient
    .from("task_nse")
    .update({ closing_balance: updatedClosingBalance })
    .eq("sr_no", lastSettledSrNo);

  if (updateErr) {
    alert("Closing Balance અપડેટ કરવામાં એરર આવી: " + updateErr.message);
  } else {
    alert(`Task ${nextTaskNumber} (Level ${initialLevel}) બની ગયો!\nનવું Closing Balance: ₹${updatedClosingBalance.toFixed(2)}`);
    document.getElementById("input_task_amount").value = "";
    document.getElementById("create-task-form").style.display = "none";
    initializePage();
  }
});

// ==========================================
// PLAY ACTIVE TASK (BUY OR SELL FIRST + AUTO CHARGES)
// ==========================================

const taskBuyForm = document.getElementById("task-buy-form");
const taskProgressSection = document.getElementById("task-progress-section");
const taskCompleteForm = document.getElementById("task-complete-form");

const tSegmentSelect = document.getElementById("t_trade_segment");
const tradeSideSelect = document.getElementById("t_trade_side");
const tFirstPriceInput = document.getElementById("t_first_price");
const tFirstQtyInput = document.getElementById("t_first_qty");
const tFirstChargesInput = document.getElementById("t_first_charges");

function updateTaskFirstAutoCharges() {
  const seg = tSegmentSelect.value;
  const side = tradeSideSelect.value;
  const price = parseFloat(tFirstPriceInput.value);
  const qty = parseFloat(tFirstQtyInput.value);
  tFirstChargesInput.value = calculateSahiCharges(seg, side, price, qty);
}

tSegmentSelect.addEventListener("change", updateTaskFirstAutoCharges);
tFirstPriceInput.addEventListener("input", updateTaskFirstAutoCharges);
tFirstQtyInput.addEventListener("input", updateTaskFirstAutoCharges);

tradeSideSelect.addEventListener("change", () => {
  const side = tradeSideSelect.value;
  if (side === "BUY") {
    document.getElementById("lbl_first_price").innerText = "Buy Price:";
    document.getElementById("lbl_first_qty").innerText = "Buy Qty:";
    document.getElementById("lbl_first_charges").innerText = "Buy Charges (Auto Calculated):";
  } else {
    document.getElementById("lbl_first_price").innerText = "Sell Price:";
    document.getElementById("lbl_first_qty").innerText = "Sell Qty:";
    document.getElementById("lbl_first_charges").innerText = "Sell Charges (Auto Calculated):";
  }
  updateTaskFirstAutoCharges();
});

document.getElementById("btn-task-new").addEventListener("click", () => {
  taskBuyForm.style.display = "block";
  taskProgressSection.style.display = "none";
});

document.getElementById("save-task-first-btn").addEventListener("click", async () => {
  const task_number = document.getElementById("select_active_task").value;
  const side = tradeSideSelect.value;
  const date = document.getElementById("t_first_date").value;
  const stock_name = document.getElementById("t_stock_name").value.trim().toUpperCase();
  const price = parseFloat(tFirstPriceInput.value);
  const qty = parseFloat(tFirstQtyInput.value);
  const charges = parseFloat(tFirstChargesInput.value) || 0;

  if (!task_number) {
    alert("કોઈ Active Task ઉપલબ્ધ નથી!");
    return;
  }

  if (!date || !stock_name || isNaN(price) || isNaN(qty)) {
    alert("કૃપા કરીને બધી વિગતો ભરો!");
    return;
  }

  const { data: existingOpen } = await supabaseClient
    .from("nse_task_trades")
    .select("sr_no")
    .eq("task_number", Number(task_number))
    .or("buy_price.is.null,sell_price.is.null");

  if (existingOpen && existingOpen.length > 0) {
    alert(`Task ${task_number} પહેલેથી જ In Progress છે! પહેલા તે ટ્રેડ પૂર્ણ કરો.`);
    await loadNseTasks();
    return;
  }

  const amount = price * qty;
  const payload = {
    task_number: Number(task_number),
    date: date,
    stock_name: stock_name
  };

  if (side === "BUY") {
    payload.buy_price = price;
    payload.buy_qty = qty;
    payload.buy_charges = charges;
    payload.buy_amount = amount;
  } else {
    payload.sell_price = price;
    payload.sell_qty = qty;
    payload.sell_charges = charges;
    payload.sell_amount = amount;
  }

  const { error } = await supabaseClient.from("nse_task_trades").insert([payload]);

  if (error) {
    alert("એન્ટ્રી સેવ કરવામાં એરર આવી: " + error.message);
    return;
  }

  await supabaseClient
    .from("nse_task")
    .update({ status: "In Progress" })
    .eq("task_number", Number(task_number));

  alert(`Task ${task_number} માટે ${stock_name} ની ${side} એન્ટ્રી (Charges: ₹${charges}) સેવ થઈ ગઈ!`);
  document.getElementById("t_stock_name").value = "";
  tFirstPriceInput.value = "";
  tFirstQtyInput.value = "";
  tFirstChargesInput.value = "";
  taskBuyForm.style.display = "none";

  await loadNseTasks();
});

// Second Entry ના ચાર્જ ઓટો ગણવાનું ફંક્શન
const tCompleteSegmentSelect = document.getElementById("t_complete_segment");
const tSecondPriceInput = document.getElementById("t_second_price");
const tSecondQtyInput = document.getElementById("t_second_qty");
const tSecondChargesInput = document.getElementById("t_second_charges");

function updateTaskSecondAutoCharges() {
  const seg = tCompleteSegmentSelect.value;
  const side = document.getElementById("t_missing_side").value;
  const price = parseFloat(tSecondPriceInput.value);
  const qty = parseFloat(tSecondQtyInput.value);
  tSecondChargesInput.value = calculateSahiCharges(seg, side, price, qty);
}

tCompleteSegmentSelect.addEventListener("change", updateTaskSecondAutoCharges);
tSecondPriceInput.addEventListener("input", updateTaskSecondAutoCharges);
tSecondQtyInput.addEventListener("input", updateTaskSecondAutoCharges);

document.getElementById("btn-task-progress").addEventListener("click", async () => {
  taskBuyForm.style.display = "none";
  taskProgressSection.style.display = "block";
  taskCompleteForm.style.display = "none";

  const pendingList = document.getElementById("task-pending-list");
  pendingList.innerHTML = "લોડ થઈ રહ્યું છે...";

  const { data, error } = await supabaseClient
    .from("nse_task_trades")
    .select("*")
    .or("buy_price.is.null,sell_price.is.null")
    .order("sr_no", { ascending: false });

  if (error) {
    pendingList.innerHTML = "એરર: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    pendingList.innerHTML = "<p>કોઈ ટાસ્ક ટ્રેડ In Progress નથી.</p>";
    return;
  }

  pendingList.innerHTML = "";
  data.forEach((item) => {
    const isBuyDone = item.buy_price !== null;
    const doneSide = isBuyDone ? "BUY" : "SELL";
    const missingSide = isBuyDone ? "SELL" : "BUY";
    const donePrice = isBuyDone ? item.buy_price : item.sell_price;
    const doneQty = isBuyDone ? item.buy_qty : item.sell_qty;

    const div = document.createElement("div");
    div.className = "pending-item";
    div.innerHTML = `<strong>[Task ${item.task_number}] ${item.stock_name}</strong> — [${doneSide}] Qty: ${doneQty} | Price: ₹${donePrice}`;

    div.addEventListener("click", () => {
      taskCompleteForm.style.display = "block";
      document.getElementById("t-selected-title").innerText = `Task ${item.task_number} — Complete ${missingSide} Entry for ${item.stock_name}`;
      document.getElementById("lbl_second_price").innerText = `${missingSide} Price:`;
      document.getElementById("lbl_second_qty").innerText = `${missingSide} Qty:`;
      document.getElementById("lbl_second_charges").innerText = `${missingSide} Charges (Auto Calculated):`;

      document.getElementById("t_selected_trade_sr").value = item.sr_no;
      document.getElementById("t_selected_task_no").value = item.task_number;
      document.getElementById("t_missing_side").value = missingSide;
      document.getElementById("t_existing_amount").value = isBuyDone ? item.buy_amount : item.sell_amount;
      document.getElementById("t_existing_charges").value = isBuyDone ? (item.buy_charges || 0) : (item.sell_charges || 0);
      tSecondQtyInput.value = doneQty;
      tSecondPriceInput.value = "";
      tSecondChargesInput.value = "";
    });

    pendingList.appendChild(div);
  });
});

document.getElementById("complete-task-trade-btn").addEventListener("click", async () => {
  const tradeSrNo = document.getElementById("t_selected_trade_sr").value;
  const taskNo = Number(document.getElementById("t_selected_task_no").value);
  const missingSide = document.getElementById("t_missing_side").value;
  const existingAmount = parseFloat(document.getElementById("t_existing_amount").value);
  const existingCharges = parseFloat(document.getElementById("t_existing_charges").value);

  const secondPrice = parseFloat(tSecondPriceInput.value);
  const secondQty = parseFloat(tSecondQtyInput.value);
  const secondCharges = parseFloat(tSecondChargesInput.value) || 0;

  if (isNaN(secondPrice) || isNaN(secondQty)) {
    alert("કૃપા કરીને Price અને Qty દાખલ કરો!");
    return;
  }

  const secondAmount = secondPrice * secondQty;
  const buy_amount = missingSide === "BUY" ? secondAmount : existingAmount;
  const sell_amount = missingSide === "SELL" ? secondAmount : existingAmount;

  const total_trn_amount = buy_amount + sell_amount;
  const total_charges = existingCharges + secondCharges;
  const gross_profit_loss = sell_amount - buy_amount;
  const net_profit_loss = gross_profit_loss - total_charges;

  const updatePayload = {
    buy_amount: buy_amount,
    sell_amount: sell_amount,
    total_trn_amount: total_trn_amount,
    total_charges: total_charges,
    gross_profit_loss: gross_profit_loss,
    net_profit_loss: net_profit_loss
  };

  if (missingSide === "SELL") {
    updatePayload.sell_price = secondPrice;
    updatePayload.sell_qty = secondQty;
    updatePayload.sell_charges = secondCharges;
  } else {
    updatePayload.buy_price = secondPrice;
    updatePayload.buy_qty = secondQty;
    updatePayload.buy_charges = secondCharges;
  }

  const { error: tradeErr } = await supabaseClient
    .from("nse_task_trades")
    .update(updatePayload)
    .eq("sr_no", tradeSrNo);

  if (tradeErr) {
    alert("ટ્રેડ અપડેટ કરવામાં એરર આવી: " + tradeErr.message);
    return;
  }

  const { data: taskRow, error: fetchTaskErr } = await supabaseClient
    .from("nse_task")
    .select("*")
    .eq("task_number", taskNo)
    .single();

  if (fetchTaskErr || !taskRow) {
    alert("Task ની વિગત શોધવામાં એરર આવી!");
    return;
  }

  const oldTaskAmount = parseFloat(taskRow.task_amount) || 0;
  let newTaskAmount = oldTaskAmount + net_profit_loss;
  if (newTaskAmount < 0) newTaskAmount = 0;

  let newStatus = "Active";
  let newLevel = calculateTaskLevel(newTaskAmount);

  if (newTaskAmount <= 5) {
    newStatus = "Closed";
    newLevel = 0;
  }

  const { error: updateTaskErr } = await supabaseClient
    .from("nse_task")
    .update({
      task_amount: newTaskAmount,
      task_level: newLevel,
      status: newStatus
    })
    .eq("task_number", taskNo);

  if (updateTaskErr) {
    alert("Task Level અપડેટ કરવામાં એરર આવી: " + updateTaskErr.message);
  } else {
    let statusMsg =
      newStatus === "Closed"
        ? "🛑 રકમ ₹5 કે તેથી ઓછી થવાથી આ ટાસ્ક CLOSED થઈ ગયો છે."
        : `🚀 નવું લેવલ: Level ${newLevel} (ફરીથી Active)`;

    alert(
      `ટ્રેડ પૂર્ણ થયો!\n` +
      `Total Charges: ₹${total_charges.toFixed(2)}\n` +
      `Net Profit/Loss: ₹${net_profit_loss.toFixed(2)}\n` +
      `નવી Task Amount: ₹${newTaskAmount.toFixed(2)}\n` +
      statusMsg
    );

    tSecondPriceInput.value = "";
    tSecondChargesInput.value = "";
    taskCompleteForm.style.display = "none";

    await loadNseTasks();
    document.getElementById("btn-task-progress").click();
  }
});

initializePage();
