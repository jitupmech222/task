// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

let allTaskNseRows = [];
let lastActuallyClosing = 0;
let amountForTask = 0;
let nextTaskNumber = 1;

const loadingMsg = document.getElementById("loading-msg");
const pendingWarning = document.getElementById("pending-warning");
const taskGeneratorArea = document.getElementById("task-generator-area");

function calculateTaskLevel(amount) {
  if (amount <= 5) return 0;
  if (amount < 20) return 1;
  return Math.floor(Math.log2(amount / 10)) + 1;
}

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

    allTaskNseRows = allTrades;
    const latestSettledRow = allTrades[0];
    lastActuallyClosing = round2(
      latestSettledRow.actually_closing !== null && latestSettledRow.actually_closing !== undefined
        ? parseFloat(latestSettledRow.actually_closing)
        : parseFloat(latestSettledRow.closing_balance) || 0
    );

    amountForTask = round2(allTrades.reduce((sum, r) => sum + (parseFloat(r.for_task) || 0), 0));

    document.getElementById("display-closing-bal").innerText = `₹${lastActuallyClosing.toFixed(2)}`;
    document.getElementById("display-task-available").innerText = `₹${amountForTask.toFixed(2)}`;

    taskGeneratorArea.style.display = "block";

    await loadNseTasks();
  } catch (err) {
    loadingMsg.innerHTML = `<span style="color:red;">સિસ્ટમ એરર: ${err.message}</span>`;
  }
}

async function loadNseTasks() {
  const tbody = document.getElementById("nse-task-tbody");

  try {
    const { data: tasks, error } = await supabaseClient
      .from("nse_task")
      .select("*")
      .order("task_number", { ascending: false });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:red;">એરર: ${error.message}</td></tr>`;
      return;
    }

    const { data: openTrades } = await supabaseClient
      .from("nse_task_trades")
      .select("task_number")
      .or("buy_price.is.null,sell_price.is.null");

    const inProgressTaskNumbers = new Set(
      (openTrades || []).map((tr) => Number(tr.task_number))
    );

    if (!tasks || tasks.length === 0) {
      nextTaskNumber = 1;
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:16px;">હજુ સુધી કોઈ ટાસ્ક બન્યો નથી.</td></tr>';
    } else {
      nextTaskNumber = Number(tasks[0].task_number) + 1;
      tbody.innerHTML = "";

      tasks.forEach((t) => {
        const initAmt = round2(t.initial_amount ?? t.task_amount);
        const amt = round2(t.task_amount);
        const lvl = calculateTaskLevel(amt);
        const isCurrentlyPlaying = inProgressTaskNumbers.has(Number(t.task_number));

        let displayStatus = t.status || (amt <= 5 ? "Closed" : "Active");
        if (displayStatus !== "Closed" && isCurrentlyPlaying) {
          displayStatus = "In Progress";
        }

        let statusBadge = "";
        if (displayStatus === "Closed") {
          statusBadge = `<span class="badge badge-closed">Closed</span>`;
        } else if (displayStatus === "In Progress") {
          statusBadge = `<a href="play_task.html" class="badge badge-progress" style="text-decoration:none;" title="In Progress ટાસ્ક પૂર્ણ કરો">⏳ In Progress</a>`;
        } else {
          statusBadge = `<a href="play_task.html?level=${lvl}&task=${t.task_number}" class="badge badge-active" style="text-decoration:none;" title="Task ${t.task_number} રમો">▶️ Active</a>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>Task ${t.task_number}</strong></td>
          <td>₹${initAmt.toFixed(2)}</td>
          <td><strong>₹${amt.toFixed(2)}</strong></td>
          <td><strong>Level ${lvl}</strong></td>
          <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.getElementById("auto_task_number").value = nextTaskNumber;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:red;">એરર: ${err.message}</td></tr>`;
  }
}

document.getElementById("show-create-form-btn").addEventListener("click", () => {
  const form = document.getElementById("create-task-form");
  form.style.display = form.style.display === "none" ? "block" : "none";
  document.getElementById("auto_task_number").value = nextTaskNumber;
});

document.getElementById("save-task-btn").addEventListener("click", async () => {
  const taskAmount = round2(parseFloat(document.getElementById("input_task_amount").value));

  if (isNaN(taskAmount) || taskAmount <= 5) {
    alert("ટાસ્ક શરૂ કરવા માટે ₹5 થી વધુ રકમ દાખલ કરો!");
    return;
  }

  if (taskAmount > amountForTask) {
    alert(`તમારી પાસે for_task માં ફક્ત ₹${amountForTask.toFixed(2)} ઉપલબ્ધ છે!`);
    return;
  }

  const initialLevel = calculateTaskLevel(taskAmount);

  // Save task to nse_task
  const { error: insertErr } = await supabaseClient
    .from("nse_task")
    .insert([
      {
        task_number: nextTaskNumber,
        initial_amount: taskAmount,
        task_amount: taskAmount,
        task_level: initialLevel,
        status: "Active"
      }
    ]);

  if (insertErr) {
    alert("ટાસ્ક સેવ કરવામાં એરર આવી: " + insertErr.message);
    return;
  }

  // Deduct from for_task in task_nse
  let remainingToDeduct = taskAmount;
  const rowsWithTaskBalance = [...allTaskNseRows]
    .filter((r) => (parseFloat(r.for_task) || 0) > 0)
    .sort((a, b) => Number(a.sr_no) - Number(b.sr_no));

  for (const row of rowsWithTaskBalance) {
    if (remainingToDeduct <= 0) break;

    const currentRowForTask = round2(parseFloat(row.for_task) || 0);
    const deduct = round2(Math.min(currentRowForTask, remainingToDeduct));
    const updatedRowForTask = round2(currentRowForTask - deduct);

    const { error: deductErr } = await supabaseClient
      .from("task_nse")
      .update({ for_task: updatedRowForTask })
      .eq("sr_no", row.sr_no);

    if (deductErr) {
      alert("for_task અપડેટ કરવામાં એરર આવી: " + deductErr.message);
      return;
    }

    remainingToDeduct = round2(remainingToDeduct - deduct);
  }

  const remainingForTask = round2(amountForTask - taskAmount);
  alert(`Task ${nextTaskNumber} (Level ${initialLevel}) બની ગયો!\nબાકી રહેલ Amount for Task: ₹${remainingForTask.toFixed(2)}`);
  document.getElementById("input_task_amount").value = "";
  document.getElementById("create-task-form").style.display = "none";
  initializePage();
});

initializePage();
