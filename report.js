// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

let availableWithdrawalBalance = 0;
let latestSettledRecord = null;
let currentTreadingAmount = 10000;

function setTodayDates() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const formatted = `${yyyy}-${mm}-${dd}`;
  document.getElementById("w_date").value = formatted;
  document.getElementById("a_date").value = formatted;
}

async function loadCapitalReport() {
  const loadingEl = document.getElementById("report-loading");
  const cardsArea = document.getElementById("summary-cards-area");

  loadingEl.style.display = "block";
  cardsArea.style.display = "none";

  try {
    // 1. task_nse ટેબલમાંથી બધો ડેટા લાવો
    const { data: nseRows, error: nseErr } = await supabaseClient
      .from("task_nse")
      .select("*")
      .order("sattelment", { ascending: false });

    if (nseErr) throw nseErr;

    // 2. nse_task ટેબલમાંથી બધા ટાસ્ક લાવો
    const { data: taskRows, error: taskErr } = await supabaseClient
      .from("nse_task")
      .select("*");

    if (taskErr) throw taskErr;

    // 3. nse_saving_withdrawals ટેબલમાંથી બધા ઉપાડ લાવો
    const { data: withdrawRows, error: wErr } = await supabaseClient
      .from("nse_saving_withdrawals")
      .select("*");

    if (wErr) throw wErr;

    // 4. nse_added_amounts ટેબલમાંથી ઉમેરેલી બધી રકમ લાવો
    const { data: addedRows, error: aErr } = await supabaseClient
      .from("nse_added_amounts")
      .select("*");

    if (aErr) throw aErr;

    // --- ગણતરીઓ ---

    // A) Treading Amount = છેલ્લા સેટલમેન્ટની actually_closing રકમ
    const settledRows = (nseRows || []).filter((r) => r.sattelment !== null);
    latestSettledRecord = settledRows.length > 0 ? settledRows[0] : null;

    if (latestSettledRecord) {
      currentTreadingAmount = round2(
        latestSettledRecord.actually_closing !== null && latestSettledRecord.actually_closing !== undefined
          ? parseFloat(latestSettledRecord.actually_closing)
          : parseFloat(latestSettledRecord.closing_balance) || 0
      );
    } else {
      const totalAdded = round2((addedRows || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0));
      currentTreadingAmount = round2(10000 + totalAdded);
    }

    // B) Task Amount = task_nse ના બધા for_task નો સરવાળો
    const taskAmountBalance = round2(
      (nseRows || []).reduce((sum, r) => sum + (parseFloat(r.for_task) || 0), 0)
    );

    // C) Active Task Amount = જે ટાસ્ક Closed નથી તેમની task_amount નો સરવાળો
    const activeTaskAmount = round2(
      (taskRows || []).reduce((sum, t) => {
        const amt = parseFloat(t.task_amount) || 0;
        const status = t.status || (amt <= 5 ? "Closed" : "Active");
        if (status !== "Closed" && amt > 5) {
          return sum + amt;
        }
        return sum;
      }, 0)
    );

    // D) Total Saving Amount = task_nse ના બધા for_saving નો સરવાળો
    const totalSavingAmount = round2(
      (nseRows || []).reduce((sum, r) => sum + (parseFloat(r.for_saving) || 0), 0)
    );

    // E) Withdrawal Amount = nse_saving_withdrawals નો કુલ સરવાળો
    const totalWithdrawalAmount = round2(
      (withdrawRows || []).reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0)
    );

    // F) Balance for Withdrawal = Total Saving - Total Withdrawal
    availableWithdrawalBalance = round2(totalSavingAmount - totalWithdrawalAmount);

    // G) Total Added Amount = nse_added_amounts નો કુલ સરવાળો
    const totalAddedAmount = round2(
      (addedRows || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
    );

    // H) Total Capital
    const totalCapital = round2(
      currentTreadingAmount + availableWithdrawalBalance + taskAmountBalance + activeTaskAmount
    );

    // સ્ક્રીન પર કાર્ડ અપડેટ કરો
    document.getElementById("val-total-capital").innerText = `₹${totalCapital.toFixed(2)}`;
    document.getElementById("val-treading-amt").innerText = `₹${currentTreadingAmount.toFixed(2)}`;
    document.getElementById("val-task-amt").innerText = `₹${taskAmountBalance.toFixed(2)}`;
    document.getElementById("val-active-task-amt").innerText = `₹${activeTaskAmount.toFixed(2)}`;
    document.getElementById("val-total-saving").innerText = `₹${totalSavingAmount.toFixed(2)}`;
    document.getElementById("val-withdrawal-amt").innerText = `₹${totalWithdrawalAmount.toFixed(2)}`;
    document.getElementById("val-balance-withdrawal").innerText = `₹${availableWithdrawalBalance.toFixed(2)}`;
    document.getElementById("val-added-amt").innerText = `₹${totalAddedAmount.toFixed(2)}`;
    document.getElementById("max-withdraw-hint").innerText = `₹${availableWithdrawalBalance.toFixed(2)}`;

    loadingEl.style.display = "none";
    cardsArea.style.display = "grid";
  } catch (err) {
    loadingEl.innerHTML = `<span style="color:red;">એરર આવી: ${err.message}</span>`;
  }
}

// + Add Treading Amount ફોર્મ ટોગલ
document.getElementById("btn-toggle-add").addEventListener("click", () => {
  const addBox = document.getElementById("add-amount-form-box");
  const wBox = document.getElementById("withdraw-form-box");
  wBox.style.display = "none";
  addBox.style.display = addBox.style.display === "none" ? "block" : "none";
});

// - Withdraw from Saving ફોર્મ ટોગલ
document.getElementById("btn-toggle-withdraw").addEventListener("click", () => {
  const addBox = document.getElementById("add-amount-form-box");
  const wBox = document.getElementById("withdraw-form-box");
  addBox.style.display = "none";
  wBox.style.display = wBox.style.display === "none" ? "block" : "none";
});

// 1. Added Amount સેવ કરો અને છેલ્લા Closing / Actually Closing માં ઉમેરો
document.getElementById("btn-save-added").addEventListener("click", async () => {
  const date = document.getElementById("a_date").value;
  const amount = round2(parseFloat(document.getElementById("a_amount").value));
  const remark = document.getElementById("a_remark").value.trim();

  if (!date || isNaN(amount) || amount <= 0) {
    alert("કૃપા કરીને સાચી તારીખ અને ઉમેરવાની રકમ દાખલ કરો!");
    return;
  }

  // A) nse_added_amounts ટેબલમાં સેવ કરો
  const { error: insertErr } = await supabaseClient
    .from("nse_added_amounts")
    .insert([{ date: date, amount: amount, remark: remark || null }]);

  if (insertErr) {
    alert("Added Amount સેવ કરવામાં એરર આવી: " + insertErr.message);
    return;
  }

  // B) task_nse ના છેલ્લા સેટલમેન્ટ થયેલા રેકોર્ડની actually_closing અને closing_balance અપડેટ કરો
  if (latestSettledRecord) {
    const oldActually =
      latestSettledRecord.actually_closing !== null && latestSettledRecord.actually_closing !== undefined
        ? parseFloat(latestSettledRecord.actually_closing)
        : parseFloat(latestSettledRecord.closing_balance) || 0;

    const oldClosing = parseFloat(latestSettledRecord.closing_balance) || oldActually;

    const newActuallyClosing = round2(oldActually + amount);
    const newClosingBalance = round2(oldClosing + amount);

    const { error: updateErr } = await supabaseClient
      .from("task_nse")
      .update({
        actually_closing: newActuallyClosing,
        closing_balance: newClosingBalance
      })
      .eq("sr_no", latestSettledRecord.sr_no);

    if (updateErr) {
      alert("Closing Balance અપડેટ કરવામાં એરર આવી: " + updateErr.message);
      return;
    }

    alert(`₹${amount.toFixed(2)} સફળતાપૂર્વક ઉમેરાઈ ગયા!\nનવું Treading Amount (Actually Closing): ₹${newActuallyClosing.toFixed(2)}`);
  } else {
    alert(`₹${amount.toFixed(2)} સફળતાપૂર્વક ઉમેરાઈ ગયા!`);
  }

  document.getElementById("a_amount").value = "";
  document.getElementById("a_remark").value = "";
  document.getElementById("add-amount-form-box").style.display = "none";
  await loadCapitalReport();
});

// 2. Saving માંથી Withdrawal સેવ કરો
document.getElementById("btn-save-withdrawal").addEventListener("click", async () => {
  const date = document.getElementById("w_date").value;
  const amount = round2(parseFloat(document.getElementById("w_amount").value));
  const remark = document.getElementById("w_remark").value.trim();

  if (!date || isNaN(amount) || amount <= 0) {
    alert("કૃપા કરીને સાચી તારીખ અને ઉપાડવાની રકમ દાખલ કરો!");
    return;
  }

  if (amount > availableWithdrawalBalance) {
    alert(`તમારી પાસે બચતમાં ઉપાડ માટે ફક્ત ₹${availableWithdrawalBalance.toFixed(2)} ઉપલબ્ધ છે!`);
    return;
  }

  const { error } = await supabaseClient
    .from("nse_saving_withdrawals")
    .insert([{ date: date, amount: amount, remark: remark || null }]);

  if (error) {
    alert("Withdrawal સેવ કરવામાં એરર આવી: " + error.message);
  } else {
    alert(`₹${amount.toFixed(2)} નો ઉપાડ સફળતાપૂર્વક નોંધાઈ ગયો છે!`);
    document.getElementById("w_amount").value = "";
    document.getElementById("w_remark").value = "";
    document.getElementById("withdraw-form-box").style.display = "none";
    await loadCapitalReport();
  }
});

setTodayDates();
loadCapitalReport();
