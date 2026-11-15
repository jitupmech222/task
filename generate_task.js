// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let lastSettledSrNo = null;
let currentClosingBalance = 0;
let amountForTask = 0;
let nextTaskNumber = 1;

const loadingMsg = document.getElementById("loading-msg");
const pendingWarning = document.getElementById("pending-warning");
const taskGeneratorArea = document.getElementById("task-generator-area");

// 1. શરત ચેક કરો અને ડેટા લોડ કરો
async function initializePage() {
  loadingMsg.style.display = "block";
  pendingWarning.style.display = "none";
  taskGeneratorArea.style.display = "none";

  // task_nse ટેબલમાંથી બધી રો લાવો
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

  // ચેક કરો કે કોઈ પણ રો માં sattelment, opening_balance કે closing_balance ખાલી છે?
  const hasIncompleteSettlement = allTrades.some(
    (row) =>
      row.sattelment === null ||
      row.opening_balance === null ||
      row.closing_balance === null
  );

  if (hasIncompleteSettlement) {
    pendingWarning.style.display = "block";
    return;
  }

  // બધા Sattelment પૂર્ણ છે! છેલ્લા (સૌથી મોટા) Sattelment વાળી રો શોધો
  const latestSettledRow = allTrades[0];
  lastSettledSrNo = latestSettledRow.sr_no;
  currentClosingBalance = parseFloat(latestSettledRow.closing_balance) || 0;

  // ગણતરી: amount for task = closing_balance - 10000
  amountForTask = currentClosingBalance - 10000;

  document.getElementById("display-closing-bal").innerText = `₹${currentClosingBalance.toFixed(2)}`;
  document.getElementById("display-task-available").innerText = `₹${amountForTask.toFixed(2)}`;

  taskGeneratorArea.style.display = "block";

  // nse_task ટેબલમાંથી ટાસ્ક લિસ્ટ અને આગળનો task_number લાવો
  await loadNseTasks();
}

// 2. nse_task ટેબલનો ડેટા લોડ કરો
async function loadNseTasks() {
  const tbody = document.getElementById("nse-task-tbody");
  const { data: tasks, error } = await supabaseClient
    .from("nse_task")
    .select("*")
    .order("task_number", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:red;">એરર: ${error.message}</td></tr>`;
    return;
  }

  if (!tasks || tasks.length === 0) {
    nextTaskNumber = 1;
    tbody.innerHTML = '<tr><td colspan="3">હજુ સુધી કોઈ ટાસ્ક બન્યો નથી.</td></tr>';
  } else {
    nextTaskNumber = Number(tasks[0].task_number) + 1;
    tbody.innerHTML = "";
    tasks.forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.sr_no}</td>
        <td><strong>Task ${t.task_number}</strong></td>
        <td>₹${Number(t.task_amount).toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("auto_task_number").value = nextTaskNumber;
}

// '+ Create Task' બટન દબાવતા ફોર્મ ખોલો
document.getElementById("show-create-form-btn").addEventListener("click", () => {
  document.getElementById("create-task-form").style.display = "block";
  document.getElementById("auto_task_number").value = nextTaskNumber;
});

// 3. ટાસ્ક સેવ કરો અને last closing_balance માંથી task_amount બાદ કરો
document.getElementById("save-task-btn").addEventListener("click", async () => {
  const taskAmount = parseFloat(document.getElementById("input_task_amount").value);

  if (isNaN(taskAmount) || taskAmount <= 0) {
    alert("કૃપા કરીને સાચી Task Amount દાખલ કરો!");
    return;
  }

  if (taskAmount > amountForTask) {
    alert(`તમારી પાસે ટાસ્ક માટે ફક્ત ₹${amountForTask.toFixed(2)} ઉપલબ્ધ છે!`);
    return;
  }

  // A) nse_task ટેબલમાં નવો ટાસ્ક ઉમેરો
  const { error: insertErr } = await supabaseClient
    .from("nse_task")
    .insert([
      {
        task_number: nextTaskNumber,
        task_amount: taskAmount
      }
    ]);

  if (insertErr) {
    alert("ટાસ્ક સેવ કરવામાં એરર આવી: " + insertErr.message);
    return;
  }

  // B) છેલ્લા closing_balance માંથી task_amount બાદ કરીને task_nse અપડેટ કરો
  const updatedClosingBalance = currentClosingBalance - taskAmount;

  const { error: updateErr } = await supabaseClient
    .from("task_nse")
    .update({ closing_balance: updatedClosingBalance })
    .eq("sr_no", lastSettledSrNo);

  if (updateErr) {
    alert("Closing Balance અપડેટ કરવામાં એરર આવી: " + updateErr.message);
  } else {
    alert(
      `Task ${nextTaskNumber} સફળતાપૂર્વક બની ગયો!\n` +
      `Task Amount: ₹${taskAmount.toFixed(2)}\n` +
      `નવું Closing Balance: ₹${updatedClosingBalance.toFixed(2)}`
    );
    document.getElementById("input_task_amount").value = "";
    document.getElementById("create-task-form").style.display = "none";
    // પેજ રિફ્રેશ કરીને નવું બેલેન્સ અને નવો ટાસ્ક નંબર બતાવો
    initializePage();
  }
});

// પેજ લોડ થતા શરૂ કરો
initializePage();
