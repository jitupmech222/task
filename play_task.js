// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

// SAHI Brokerage & Charges calculation
function calculateSahiCharges(segment, side, price, qty) {
  if (!segment || !side) return 0;
  const turnover = round2(price * qty);
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
  return round2(brokerage + stt + exch + sebi + stamp + gst);
}

// Calculate Task Level from Amount (10=L1, 20=L2, 40=L3, 80=L4, 160=L5, 320=L6...)
function calculateTaskLevel(amount) {
  if (amount <= 5) return 0;
  if (amount < 20) return 1;
  return Math.floor(Math.log2(amount / 10)) + 1;
}

let allActiveTasks = [];
let tasksByLevel = {};

const selectLevelDropdown = document.getElementById("select_task_level");
const selectTaskDropdown = document.getElementById("select_active_task");
const taskBuyForm = document.getElementById("task-buy-form");
const taskProgressSection = document.getElementById("task-progress-section");
const taskCompleteForm = document.getElementById("task-complete-form");

const tSegmentSelect = document.getElementById("t_trade_segment");
const tradeSideSelect = document.getElementById("t_trade_side");
const tFirstPriceInput = document.getElementById("t_first_price");
const tFirstQtyInput = document.getElementById("t_first_qty");
const tFirstChargesInput = document.getElementById("t_first_charges");

// Auto calculate charges for first trade
function updateTaskFirstAutoCharges() {
  const seg = tSegmentSelect.value;
  const side = tradeSideSelect.value;
  const price = parseFloat(tFirstPriceInput.value);
  const qty = parseFloat(tFirstQtyInput.value);
  tFirstChargesInput.value = calculateSahiCharges(seg, side, price, qty).toFixed(2);
}

tSegmentSelect.addEventListener("change", updateTaskFirstAutoCharges);
tFirstPriceInput.addEventListener("input", updateTaskFirstAutoCharges);
tFirstQtyInput.addEventListener("input", updateTaskFirstAutoCharges);

tradeSideSelect.addEventListener("change", () => {
  const side = tradeSideSelect.value;
  if (side === "BUY") {
    document.getElementById("lbl_first_price").innerText = "Buy Price (₹):";
    document.getElementById("lbl_first_qty").innerText = "Buy Qty:";
    document.getElementById("lbl_first_charges").innerText = "Buy Charges (Auto):";
  } else if (side === "SELL") {
    document.getElementById("lbl_first_price").innerText = "Sell Price (₹):";
    document.getElementById("lbl_first_qty").innerText = "Sell Qty:";
    document.getElementById("lbl_first_charges").innerText = "Sell Charges (Auto):";
  } else {
    document.getElementById("lbl_first_price").innerText = "Price (₹):";
    document.getElementById("lbl_first_qty").innerText = "Quantity (Qty):";
    document.getElementById("lbl_first_charges").innerText = "Charges (Auto):";
  }
  updateTaskFirstAutoCharges();
});

// Load tasks, group by level, and populate level dropdown
async function loadActiveTasks() {
  try {
    selectLevelDropdown.innerHTML = '<option value="">લોડ થઈ રહ્યું છે...</option>';
    selectTaskDropdown.innerHTML = '<option value="">લોડ થઈ રહ્યું છે...</option>';

    const { data: tasks, error } = await supabaseClient
      .from("nse_task")
      .select("*")
      .order("task_number", { ascending: false });

    if (error) {
      selectLevelDropdown.innerHTML = '<option value="">એરર આવી</option>';
      selectTaskDropdown.innerHTML = `<option value="">એરર: ${error.message}</option>`;
      return;
    }

    // Get tasks that are currently In Progress
    const { data: openTrades } = await supabaseClient
      .from("nse_task_trades")
      .select("task_number")
      .or("buy_price.is.null,sell_price.is.null");

    const inProgressTaskNumbers = new Set(
      (openTrades || []).map((tr) => Number(tr.task_number))
    );

    allActiveTasks = [];
    tasksByLevel = {};

    (tasks || []).forEach((t) => {
      const amt = round2(t.task_amount);
      const lvl = calculateTaskLevel(amt);
      const isCurrentlyPlaying = inProgressTaskNumbers.has(Number(t.task_number));
      let displayStatus = t.status || (amt <= 5 ? "Closed" : "Active");
      if (displayStatus !== "Closed" && isCurrentlyPlaying) {
        displayStatus = "In Progress";
      }

      // Only tasks that are fully Active (ready to play a new trade)
      if (displayStatus === "Active") {
        allActiveTasks.push({ ...t, calculated_level: lvl });

        if (!tasksByLevel[lvl]) {
          tasksByLevel[lvl] = [];
        }
        tasksByLevel[lvl].push(t);
      }
    });

    // Populate Level dropdown
    selectLevelDropdown.innerHTML = "";
    const activeLevels = Object.keys(tasksByLevel).map(Number).sort((a, b) => a - b);

    if (activeLevels.length === 0) {
      selectLevelDropdown.innerHTML = '<option value="">કોઈ Active Level ઉપલબ્ધ નથી</option>';
      selectTaskDropdown.innerHTML = '<option value="">કોઈ Active Task ઉપલબ્ધ નથી</option>';
      return;
    }

    // Add "All Levels" option
    const allOpt = document.createElement("option");
    allOpt.value = "ALL";
    allOpt.innerText = `All Levels (${allActiveTasks.length} Tasks)`;
    selectLevelDropdown.appendChild(allOpt);

    // Add each available level with task count
    activeLevels.forEach((lvl) => {
      const count = tasksByLevel[lvl].length;
      const baseAmt = 10 * Math.pow(2, lvl - 1);
      const opt = document.createElement("option");
      opt.value = String(lvl);
      opt.innerText = `Level ${lvl} — ₹${baseAmt} (${count} Active Tasks)`;
      selectLevelDropdown.appendChild(opt);
    });

    // Auto select first specific level or default
    selectLevelDropdown.value = String(activeLevels[0]);
    updateTaskDropdownForLevel(String(activeLevels[0]));
  } catch (err) {
    selectLevelDropdown.innerHTML = `<option value="">સિસ્ટમ એરર</option>`;
    selectTaskDropdown.innerHTML = `<option value="">${err.message}</option>`;
  }
}

// When level is selected, filter and populate the Active Task dropdown
function updateTaskDropdownForLevel(selectedLevel) {
  selectTaskDropdown.innerHTML = "";

  let filteredList = [];
  if (selectedLevel === "ALL" || !selectedLevel) {
    filteredList = allActiveTasks;
  } else {
    const lvlNum = Number(selectedLevel);
    filteredList = tasksByLevel[lvlNum] || [];
  }

  if (filteredList.length === 0) {
    selectTaskDropdown.innerHTML = '<option value="">આ Level માં કોઈ Active Task નથી</option>';
    return;
  }

  filteredList.forEach((t) => {
    const amt = round2(t.task_amount);
    const lvl = calculateTaskLevel(amt);
    const opt = document.createElement("option");
    opt.value = t.task_number;
    opt.innerText = `Task ${t.task_number} — Amount: ₹${amt.toFixed(2)} (Level ${lvl})`;
    selectTaskDropdown.appendChild(opt);
  });
}

// Level change event listener
selectLevelDropdown.addEventListener("change", () => {
  updateTaskDropdownForLevel(selectLevelDropdown.value);
});

// Toggle Modes: 1) New Entry vs 2) In Progress
document.getElementById("btn-task-new").addEventListener("click", () => {
  taskBuyForm.style.display = "block";
  taskProgressSection.style.display = "none";
  document.getElementById("btn-task-new").style.background = "var(--primary-gradient)";
  document.getElementById("btn-task-progress").style.background = "linear-gradient(135deg, #d97706, #b45309)";
});

document.getElementById("btn-task-progress").addEventListener("click", async () => {
  taskBuyForm.style.display = "none";
  taskProgressSection.style.display = "block";
  taskCompleteForm.style.display = "none";
  document.getElementById("btn-task-progress").style.background = "var(--primary-gradient)";
  document.getElementById("btn-task-new").style.background = "linear-gradient(135deg, #0284c7, #0369a1)";

  await loadInProgressTaskTrades();
});

// Save First Entry (BUY or SELL) for Active Task
document.getElementById("save-task-first-btn").addEventListener("click", async () => {
  const task_number = selectTaskDropdown.value;
  const seg = tSegmentSelect.value;
  const side = tradeSideSelect.value;
  const date = document.getElementById("t_first_date").value;
  const stock_name = document.getElementById("t_stock_name").value.trim().toUpperCase();
  const price = round2(parseFloat(tFirstPriceInput.value));
  const qty = parseFloat(tFirstQtyInput.value);
  const charges = round2(parseFloat(tFirstChargesInput.value) || 0);

  if (!task_number) {
    alert("કૃપા કરીને પહેલા Active Task પસંદ કરો!");
    return;
  }

  if (!seg) {
    alert("કૃપા કરીને પહેલા Segment પસંદ કરો!");
    return;
  }

  if (!side) {
    alert("કૃપા કરીને Trade Type (BUY અથવા SELL) પસંદ કરો!");
    return;
  }

  if (!date || !stock_name || isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
    alert("કૃપા કરીને બધી જરૂરી વિગતો (તારીખ, સ્ટોકનું નામ, Price, Qty) સાચી ભરો!");
    return;
  }

  // Check if this task already has an open trade
  const { data: existingOpen } = await supabaseClient
    .from("nse_task_trades")
    .select("sr_no")
    .eq("task_number", Number(task_number))
    .or("buy_price.is.null,sell_price.is.null");

  if (existingOpen && existingOpen.length > 0) {
    alert(`Task ${task_number} પહેલેથી જ In Progress છે! પહેલા તે ટ્રેડ પૂર્ણ કરો.`);
    await loadActiveTasks();
    return;
  }

  const amount = round2(price * qty);
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

  // Update status in nse_task to "In Progress"
  await supabaseClient
    .from("nse_task")
    .update({ status: "In Progress" })
    .eq("task_number", Number(task_number));

  alert(`Task ${task_number} માટે ${stock_name} ની ${side} એન્ટ્રી (Charges: ₹${charges.toFixed(2)}) સફળતાપૂર્વક સેવ થઈ ગઈ!`);
  
  tSegmentSelect.value = "";
  tradeSideSelect.value = "";
  document.getElementById("t_stock_name").value = "";
  tFirstPriceInput.value = "";
  tFirstQtyInput.value = "";
  tFirstChargesInput.value = "";

  await loadActiveTasks();
});

// ========================================================
// IN PROGRESS TRADES & COMPLETION LOGIC
// ========================================================
const tCompleteSegmentSelect = document.getElementById("t_complete_segment");
const tSecondPriceInput = document.getElementById("t_second_price");
const tSecondQtyInput = document.getElementById("t_second_qty");
const tSecondChargesInput = document.getElementById("t_second_charges");

function updateTaskSecondAutoCharges() {
  const seg = tCompleteSegmentSelect.value;
  const side = document.getElementById("t_missing_side").value;
  const price = parseFloat(tSecondPriceInput.value);
  const qty = parseFloat(tSecondQtyInput.value);
  tSecondChargesInput.value = calculateSahiCharges(seg, side, price, qty).toFixed(2);
}

tCompleteSegmentSelect.addEventListener("change", updateTaskSecondAutoCharges);
tSecondPriceInput.addEventListener("input", updateTaskSecondAutoCharges);
tSecondQtyInput.addEventListener("input", updateTaskSecondAutoCharges);

async function loadInProgressTaskTrades() {
  const pendingList = document.getElementById("task-pending-list");
  pendingList.innerHTML = "લોડ થઈ રહ્યું છે...";

  const { data, error } = await supabaseClient
    .from("nse_task_trades")
    .select("*")
    .or("buy_price.is.null,sell_price.is.null")
    .order("sr_no", { ascending: false });

  if (error) {
    pendingList.innerHTML = `<span style="color:red;">એરર: ${error.message}</span>`;
    return;
  }

  if (!data || data.length === 0) {
    pendingList.innerHTML = "<p style='color:#64748b; padding:12px;'>કોઈ ટાસ્ક ટ્રેડ હાલ In Progress નથી.</p>";
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
    div.innerHTML = `
      <div>
        <strong style="color:#1d4ed8; font-size:15px;">[Task ${item.task_number}] ${item.stock_name}</strong>
        <div style="font-size:13px; color:#475569; margin-top:3px;">
          <span class="badge ${doneSide === 'BUY' ? 'badge-active' : 'badge-closed'}">${doneSide} Done</span>
          Qty: <strong>${doneQty}</strong> | Price: <strong>₹${Number(donePrice).toFixed(2)}</strong> (${item.date || '-'})
        </div>
      </div>
      <button type="button" class="action-btn" style="padding: 7px 16px; font-size: 13px;">
        Complete ${missingSide} ➔
      </button>
    `;

    div.addEventListener("click", () => {
      taskCompleteForm.style.display = "block";
      document.getElementById("t-selected-title").innerText = `Task ${item.task_number} — Complete ${missingSide} Entry for ${item.stock_name}`;
      document.getElementById("lbl_second_price").innerText = `${missingSide} Price (₹):`;
      document.getElementById("lbl_second_qty").innerText = `${missingSide} Quantity (Qty):`;
      document.getElementById("lbl_second_charges").innerText = `${missingSide} Charges (Auto):`;

      tCompleteSegmentSelect.value = "";
      document.getElementById("t_selected_trade_sr").value = item.sr_no;
      document.getElementById("t_selected_task_no").value = item.task_number;
      document.getElementById("t_missing_side").value = missingSide;
      document.getElementById("t_existing_amount").value = isBuyDone ? item.buy_amount : item.sell_amount;
      document.getElementById("t_existing_charges").value = isBuyDone ? (item.buy_charges || 0) : (item.sell_charges || 0);
      tSecondQtyInput.value = doneQty;
      tSecondPriceInput.value = "";
      tSecondChargesInput.value = "";

      // Smooth scroll to completion form
      taskCompleteForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    pendingList.appendChild(div);
  });
}

// Complete Trade & Update Task Level
document.getElementById("complete-task-trade-btn").addEventListener("click", async () => {
  const seg = tCompleteSegmentSelect.value;
  const tradeSrNo = document.getElementById("t_selected_trade_sr").value;
  const taskNo = Number(document.getElementById("t_selected_task_no").value);
  const missingSide = document.getElementById("t_missing_side").value;
  const existingAmount = round2(parseFloat(document.getElementById("t_existing_amount").value));
  const existingCharges = round2(parseFloat(document.getElementById("t_existing_charges").value));

  const secondPrice = round2(parseFloat(tSecondPriceInput.value));
  const secondQty = parseFloat(tSecondQtyInput.value);
  const secondCharges = round2(parseFloat(tSecondChargesInput.value) || 0);

  if (!seg) {
    alert("કૃપા કરીને પહેલા Segment પસંદ કરો!");
    return;
  }

  if (isNaN(secondPrice) || isNaN(secondQty) || secondPrice <= 0 || secondQty <= 0) {
    alert("કૃપા કરીને Price અને Qty સાચી દાખલ કરો!");
    return;
  }

  const secondAmount = round2(secondPrice * secondQty);
  const buy_amount = missingSide === "BUY" ? secondAmount : existingAmount;
  const sell_amount = missingSide === "SELL" ? secondAmount : existingAmount;

  const total_trn_amount = round2(buy_amount + sell_amount);
  const total_charges = round2(existingCharges + secondCharges);
  const gross_profit_loss = round2(sell_amount - buy_amount);
  const net_profit_loss = round2(gross_profit_loss - total_charges);

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

  // Fetch current task row to update its balance & level
  const { data: taskRow, error: fetchTaskErr } = await supabaseClient
    .from("nse_task")
    .select("*")
    .eq("task_number", taskNo)
    .single();

  if (fetchTaskErr || !taskRow) {
    alert("Task ની વિગત શોધવામાં એરર આવી!");
    return;
  }

  const oldTaskAmount = round2(parseFloat(taskRow.task_amount) || 0);
  let newTaskAmount = round2(oldTaskAmount + net_profit_loss);
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

    await loadActiveTasks();
    await loadInProgressTaskTrades();
  }
});

// Set default date to today
const today = new Date().toISOString().split("T")[0];
document.getElementById("t_first_date").value = today;

// Initialize
loadActiveTasks();
