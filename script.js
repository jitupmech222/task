// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const buttons = document.querySelectorAll(".nav-btn");

// મુખ્ય ડેશબોર્ડ બટનોનું નેવિગેશન
buttons.forEach((button) => {
  button.addEventListener("click", () => {
    buttons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    const name = button.textContent.trim();

    if (button.dataset.href) {
      window.location.href = button.dataset.href;
    } else if (name.includes("Treading")) {
      window.location.href = "treading.html";
    } else if (name.includes("Generate task")) {
      window.location.href = "generate_task.html";
    } else if (name.includes("Play task") || name.includes("Play Task")) {
      window.location.href = "play_task.html";
    } else if (name.includes("Sattelment")) {
      window.location.href = "sattelment.html";
    } else if (name.includes("P/L")) {
      window.location.href = "pl_report.html";
    } else if (name.includes("Report")) {
      window.location.href = "report.html";
    } else if (name.includes("Data")) {
      window.location.href = "data.html";
    }
  });
});

// રકમ પરથી Level ગણવાનું ફંક્શન (10=Lvl 1, 20=Lvl 2, 40=Lvl 3, 80=Lvl 4...)
function calculateTaskLevel(amount) {
  if (amount <= 5) return 0;
  if (amount < 20) return 1;
  return Math.floor(Math.log2(amount / 10)) + 1;
}

// Dashboard Overview માં Level મુજબ Active Task ની સંખ્યા લોડ કરો
async function loadDashboardOverview() {
  const tbody = document.getElementById("overview-level-tbody");
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: #64748b;">🔄 ડેટા લોડ થઈ રહ્યો છે...</td></tr>';

    const { data: tasks, error } = await supabaseClient
      .from("nse_task")
      .select("*")
      .order("task_number", { ascending: true });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:#dc2626; text-align:center; padding: 18px;">⚠️ ડેટાબેઝ એરર: ${error.message}</td></tr>`;
      return;
    }

    const levelSummary = {
      1: { qty: 0, amount: 0 },
      2: { qty: 0, amount: 0 },
      3: { qty: 0, amount: 0 },
      4: { qty: 0, amount: 0 }
    };

    let totalActiveQty = 0;
    let totalActiveAmount = 0;

    (tasks || []).forEach((t) => {
      const amt = Number(t.task_amount) || 0;
      const status = t.status || (amt <= 5 ? "Closed" : "Active");

      if (status !== "Closed" && amt > 5) {
        const lvl = calculateTaskLevel(amt);
        if (!levelSummary[lvl]) {
          levelSummary[lvl] = { qty: 0, amount: 0 };
        }
        levelSummary[lvl].qty += 1;
        levelSummary[lvl].amount += amt;

        totalActiveQty += 1;
        totalActiveAmount += amt;
      }
    });

    document.getElementById("total-active-qty").innerText = totalActiveQty;
    document.getElementById("total-active-amt").innerText = `₹${totalActiveAmount.toFixed(2)}`;

    tbody.innerHTML = "";
    const sortedLevels = Object.keys(levelSummary)
      .map(Number)
      .sort((a, b) => a - b);

    sortedLevels.forEach((lvl) => {
      const baseAmt = 10 * Math.pow(2, lvl - 1);
      const rowData = levelSummary[lvl];

      const qtyBadge =
        rowData.qty > 0
          ? `<span class="badge badge-active">${rowData.qty} Tasks</span>`
          : `<span style="color:#94a3b8; font-weight: 500;">0</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span style="font-weight: 700; color: #1e3a8a;">Level ${lvl}</span></td>
        <td>₹${baseAmt}</td>
        <td>${qtyBadge}</td>
        <td><strong style="color: #0f172a;">₹${rowData.amount.toFixed(2)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:#dc2626; text-align:center; padding: 18px;">⚠️ સિસ્ટમ એરર: ${err.message}</td></tr>`;
  }
}

// Mobile drawer toggle functions
function openMobileDrawer() {
  const drawer = document.getElementById("mobile-drawer");
  const overlay = document.getElementById("drawer-overlay");
  if (drawer && overlay) {
    overlay.style.display = "block";
    drawer.classList.add("open");
  }
}

function closeMobileDrawer() {
  const drawer = document.getElementById("mobile-drawer");
  const overlay = document.getElementById("drawer-overlay");
  if (drawer && overlay) {
    drawer.classList.remove("open");
    setTimeout(() => {
      overlay.style.display = "none";
    }, 200);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  loadDashboardOverview();
});
