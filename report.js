// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

let availableWithdrawalBalance = 0;

// આજની તારીખ ડિફોલ્ટ સેટ કરો
function setTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  document.getElementById("w_date").value = `${yyyy}-${mm}-${dd}`;
}

// મુખ્ય Capital Report લોડ અને ગણતરી કરો
async function loadCapitalReport() {
  const loadingEl = document.getElementById("report-loading");
  const cardsArea = document.getElementById("summary-cards-area");
  const wTbody = document.getElementById("withdrawal-history-tbody");

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
      .select("*")
      .order("sr_no", { ascending: false });

    if (wErr) throw wErr;

    // --- ગણતરીઓ ---

    // A) Treading Amount = છેલ્લા સેટલમેન્ટની actually_closing રકમ
    const settledRows = (nseRows || []).filter((r) => r.sattelment !== null);
    let treadingAmount = 10000;
    if (settledRows.length > 0) {
      const latest = settledRows[0];
      treadingAmount = round2(
        latest.actually_closing !== null && latest.actually_closing !== undefined
          ? parseFloat(latest.actually_closing)
          : parseFloat(latest.closing_balance) || 0
      );
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

    // G) Total Capital = Treading Amount + Balance for Withdrawal + Task Amount + Active Task Amount
    const totalCapital = round2(
      treadingAmount + availableWithdrawalBalance + taskAmountBalance + activeTaskAmount
    );

    // સ્ક્રીન પર 7 કાર્ડ અપડેટ કરો
    document.getElementById("val-total-capital").innerText = `₹${totalCapital.toFixed(2)}`;
    document.getElementById("val-treading-amt").innerText = `₹${treadingAmount.toFixed(2)}`;
    document.getElementById("val-task-amt").innerText = `₹${taskAmountBalance.toFixed(2)}`;
    document.getElementById("val-active-task-amt").innerText = `₹${activeTaskAmount.toFixed(2)}`;
    document.getElementById("val-total-saving").innerText = `₹${totalSavingAmount.toFixed(2)}`;
    document.getElementById("val-withdrawal-amt").innerText = `₹${totalWithdrawalAmount.toFixed(2)}`;
    document.getElementById("val-balance-withdrawal").innerText = `₹${availableWithdrawalBalance.toFixed(2)}`;
    document.getElementById("max-withdraw-hint").innerText = `₹${availableWithdrawalBalance.toFixed(2)}`;

    loadingEl.style.display = "none";
    cardsArea.style.display = "grid";

    // Withdrawal History ટેબલ ભરો
    if (!withdrawRows || withdrawRows.length === 0) {
      wTbody.innerHTML = '<tr><td colspan="4">હજુ સુધી બચતમાંથી કોઈ ઉપાડ થયો નથી.</td></tr>';
    } else {
      wTbody.innerHTML = "";
      withdrawRows.forEach((w) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${w.date || "-"}</td>
          <td style="color:#dc2626; font-weight:bold;">₹${round2(w.amount).toFixed(2)}</td>
          <td>${w.remark || "-"}</td>
          <td><button type="button" class="mini-btn del-w-btn" style="background:#dc2626; padding:4px 8px; font-size:12px;">🗑️</button></td>
        `;
        tr.querySelector(".del-w-btn").addEventListener("click", () => deleteWithdrawal(w.sr_no));
        wTbody.appendChild(tr);
      });
    }
  } catch (err) {
    loadingEl.innerHTML = `<span style="color:red;">એરર આવી: ${err.message}</span>`;
  }
}

// Withdrawal ફોર્મ ખોલો/બંધ કરો
document.getElementById("btn-toggle-withdraw").addEventListener("click", () => {
  const box = document.getElementById("withdraw-form-box");
  box.style.display = box.style.display === "none" ? "block" : "none";
});

// નવો Withdrawal સેવ કરો
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

// ભૂલથી થયેલ Withdrawal ડિલીટ કરો
async function deleteWithdrawal(srNo) {
  if (!confirm("શું તમે ખરેખર આ Withdrawal એન્ટ્રી ડિલીટ કરવા માંગો છો?")) return;

  const { error } = await supabaseClient
    .from("nse_saving_withdrawals")
    .delete()
    .eq("sr_no", srNo);

  if (error) {
    alert("ડિલીટ કરવામાં એરર આવી: " + error.message);
  } else {
    await loadCapitalReport();
  }
}

setTodayDate();
loadCapitalReport();
