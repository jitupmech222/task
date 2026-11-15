// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let lastSettledSrNo = null;
let currentClosingBalance = 0;
let amountForTask = 0;
let nextTaskNumber = 1;
let activeTasksList = [];

const loadingMsg = document.getElementById("loading-msg");
const pendingWarning = document.getElementById("pending-warning");
const taskGeneratorArea = document.getElementById("task-generator-area");
const playTaskCard = document.getElementById("play-task-card");

// રકમ પરથી ઓટો Level ગણવાનું ફંક્શન (10=Lvl 1, 20=Lvl 2, 40=Lvl 3, 80=Lvl 4...)
function calculateTaskLevel(amount) {
  if (amount <= 5) return 0; // Closed
  if (amount < 20) return 1; // 5.01 થી 19.99 -> Level 1
  return Math.floor(Math.log2(amount / 10)) + 1;
}

// 1. પેજ લોડ થતા શરતો ચેક કરો
async function initializePage() {
  loadingMsg.style.display = "block";
  pendingWarning.style.display = "none";
  taskGeneratorArea.style.display = "none";

  const { data: allTrades, error } = await supabaseClient
    .from("task_nse")
    .select("*")
    .order("sattelment", { ascending: false });

  loadingMsg.style.display = "none";

  if (error) {
    alert("ડેટા લોડ કરવામાં એરર આવી: " + error.message);
    return;
  }

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
}

// 2. nse_task ટેબલમાંથી બધા ટાસ્ક લોડ કરો અને Active ટાસ્ક ડ્રોપડાઉનમાં ભરો
async function loadNseTasks() {
  const tbody = document.getElementById("nse-task-tbody");
  const selectDropdown = document.getElementById("select_active_task");

  const { data: tasks, error } = await supabaseClient
    .from("nse_task")
    .select("*")
    .order("task_number", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:red;">એરર: ${error.message}</td></tr>`;
    return;
  }

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
      const lvl = t.task_level || calculateTaskLevel(amt);
      const status = t.status || (amt <= 5 ? "Closed" : "Active");
      const statusBadge =
        status === "Active"
          ? `<span style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:4px; font-weight:bold;">Active</span>`
          : `<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:4px; font-weight:bold;">Closed</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>Task ${t.task_number}</strong></td>
        <td>₹${amt.toFixed(2)}</td>
        <td><strong>Level ${lvl}</strong></td>
        <td>${statusBadge}</td>
      `;
      tbody.appendChild(tr);

      // જો ટાસ્ક Active હોય તો Play વિભાગના ડ્રોપડાઉનમાં ઉમેરો
      if (status === "Active") {
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
}

// '+ Create Task' ફોર્મ ખોલો
document.getElementById("show-create-form-btn").addEventListener("click", () => {
  document.getElementById("create-task-form").style.display = "block";
  document.getElementById("auto_task_number").value = nextTaskNumber;
});

// નવો ટાસ્ક સેવ કરો
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
// PLAY ACTIVE TASK (1. NEW BUY & 2. IN PROGRESS SELL)
// ==========================================

const taskBuyForm = document.getElementById("task-buy-form");
const taskProgressSection = document.getElementById("task-progress-section");
const taskSellForm = document.getElementById("task-sell-form");

// 1) New Buy Entry બટન
document.getElementById("btn-task-new").addEventListener("click", () => {
  taskBuyForm.style.display = "block";
  taskProgressSection.style.display = "none";
});

// Buy વિગતો nse_task_trades માં સેવ કરો
document.getElementById("save-task-buy-btn").addEventListener("click", async () => {
  const task_number = document.getElementById("select_active_task").value;
  const date = document.getElementById("t_buy_date").value;
  const stock_name = document.getElementById("t_stock_name").value.trim().toUpperCase();
  const buy_price = parseFloat(document.getElementById("t_buy_price").value);
  const buy_qty = parseFloat(document.getElementById("t_buy_qty").value);
  const buy_charges = parseFloat(document.getElementById("t_buy_charges").value) || 0;

  if (!task_number) {
    alert("કૃપા કરીને પહેલા કોઈ Active Task પસંદ કરો!");
    return;
  }

  if (!date || !stock_name || isNaN(buy_price) || isNaN(buy_qty)) {
    alert("કૃપા કરીને બધી Buy વિગતો ભરો!");
    return;
  }

  const buy_amount = buy_price * buy_qty;

  const { error } = await supabaseClient
    .from("nse_task_trades")
    .insert([
      {
        task_number: Number(task_number),
        date: date,
        stock_name: stock_name,
        buy_price: buy_price,
        buy_qty: buy_qty,
        buy_charges: buy_charges,
        buy_amount: buy_amount
      }
    ]);

  if (error) {
    alert("Buy એન્ટ્રી સેવ કરવામાં એરર આવી: " + error.message);
  } else {
    alert(`Task ${task_number} માટે ${stock_name} ની Buy એન્ટ્રી સેવ થઈ ગઈ!`);
    document.getElementById("t_stock_name").value = "";
    document.getElementById("t_buy_price").value = "";
    document.getElementById("t_buy_qty").value = "";
    document.getElementById("t_buy_charges").value = "";
  }
});

// 2) In Progress (Sell) બટન
document.getElementById("btn-task-progress").addEventListener("click", async () => {
  taskBuyForm.style.display = "none";
  taskProgressSection.style.display = "block";
  taskSellForm.style.display = "none";

  const pendingList = document.getElementById("task-pending-list");
  pendingList.innerHTML = "લોડ થઈ રહ્યું છે...";

  const { data, error } = await supabaseClient
    .from("nse_task_trades")
    .select("*")
    .is("sell_price", null)
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
    const div = document.createElement("div");
    div.className = "pending-item";
    div.innerHTML = `<strong>[Task ${item.task_number}] ${item.stock_name}</strong> — Buy Qty: ${item.buy_qty} | Buy Price: ₹${item.buy_price}`;

    div.addEventListener("click", () => {
      taskSellForm.style.display = "block";
      document.getElementById("t-selected-title").innerText = `Task ${item.task_number} Sell Entry: ${item.stock_name} (Buy Qty: ${item.buy_qty} @ ₹${item.buy_price})`;
      document.getElementById("t_selected_trade_sr").value = item.sr_no;
      document.getElementById("t_selected_task_no").value = item.task_number;
      document.getElementById("t_hidden_buy_amount").value = item.buy_amount;
      document.getElementById("t_hidden_buy_charges").value = item.buy_charges || 0;
      document.getElementById("t_sell_qty").value = item.buy_qty;
    });

    pendingList.appendChild(div);
  });
});

// Sell પૂર્ણ કરો અને net_profit_loss મુજબ Level Up / Down / Closed કરો
document.getElementById("update-task-sell-btn").addEventListener("click", async () => {
  const tradeSrNo = document.getElementById("t_selected_trade_sr").value;
  const taskNo = Number(document.getElementById("t_selected_task_no").value);
  const buy_amount = parseFloat(document.getElementById("t_hidden_buy_amount").value);
  const buy_charges = parseFloat(document.getElementById("t_hidden_buy_charges").value);

  const sell_price = parseFloat(document.getElementById("t_sell_price").value);
  const sell_qty = parseFloat(document.getElementById("t_sell_qty").value);
  const sell_charges = parseFloat(document.getElementById("t_sell_charges").value) || 0;

  if (isNaN(sell_price) || isNaN(sell_qty)) {
    alert("કૃપા કરીને Sell Price અને Sell Qty દાખલ કરો!");
    return;
  }

  // ગણતરીઓ:
  const sell_amount = sell_price * sell_qty;
  const total_trn_amount = buy_amount + sell_amount;
  const total_charges = buy_charges + sell_charges;
  const gross_profit_loss = sell_amount - buy_amount;
  const net_profit_loss = gross_profit_loss - total_charges;

  // 1. nse_task_trades ટેબલમાં Sell વિગતો અપડેટ કરો
  const { error: tradeErr } = await supabaseClient
    .from("nse_task_trades")
    .update({
      sell_price: sell_price,
      sell_qty: sell_qty,
      sell_charges: sell_charges,
      sell_amount: sell_amount,
      total_trn_amount: total_trn_amount,
      total_charges: total_charges,
      gross_profit_loss: gross_profit_loss,
      net_profit_loss: net_profit_loss
    })
    .eq("sr_no", tradeSrNo);

  if (tradeErr) {
    alert("ટ્રેડ અપડેટ કરવામાં એરર આવી: " + tradeErr.message);
    return;
  }

  // 2. હાલના Task ની જૂની રકમ લાવો અને net_profit_loss ઉમેરો/બાદ કરો
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

  // 3. નિયમ મુજબ Level અને Status (<= 5 હોય તો Closed) નક્કી કરો
  let newStatus = "Active";
  let newLevel = calculateTaskLevel(newTaskAmount);

  if (newTaskAmount <= 5) {
    newStatus = "Closed";
    newLevel = 0;
  }

  // 4. nse_task ટેબલમાં નવી રકમ, નવું લેવલ અને સ્ટેટસ અપડેટ કરો
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
        : `🚀 નવું લેવલ: Level ${newLevel} (Active)`;

    alert(
      `ટ્રેડ પૂર્ણ થયો!\n` +
      `Net Profit/Loss: ₹${net_profit_loss.toFixed(2)}\n` +
      `નવી Task Amount: ₹${newTaskAmount.toFixed(2)}\n` +
      statusMsg
    );

    document.getElementById("t_sell_price").value = "";
    document.getElementById("t_sell_charges").value = "";
    taskSellForm.style.display = "none";

    // પેજ અને લિસ્ટ રિફ્રેશ કરો
    await loadNseTasks();
    document.getElementById("btn-task-progress").click();
  }
});

// પેજ લોડ થતા શરૂ કરો
initializePage();
