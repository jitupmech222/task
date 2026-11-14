const buttons = document.querySelectorAll(".nav-btn");
const statusText = document.getElementById("status-text");
const defaultCard = document.getElementById("default-card");
const treadingSection = document.getElementById("treading-section");

// Supabase setup (અહીં તમારી સાચી URL અને Key મૂકવી)
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_SUPABASE_ANON_KEY";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// મુખ્ય ડેશબોર્ડ બટનોનું નેવિગેશન
buttons.forEach((button) => {
  button.addEventListener("click", () => {
    buttons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    const name = button.textContent.trim();
    if (name === "Treading") {
      treadingSection.style.display = "block";
      defaultCard.style.display = "none";
    } else {
      treadingSection.style.display = "none";
      defaultCard.style.display = "block";
      statusText.textContent = `${name} button selected. Functionality will be added later.`;
    }
  });
});

// Treading વિભાગના બટનો અને ફોર્મ
const btnNew = document.getElementById("btn-new");
const btnInProgress = document.getElementById("btn-in-progress");
const newTradeForm = document.getElementById("new-trade-form");
const inProgressSection = document.getElementById("in-progress-section");
const sellTradeForm = document.getElementById("sell-trade-form");

// 1) New બટન પર ક્લિક કરતા
btnNew.addEventListener("click", () => {
  newTradeForm.style.display = "block";
  inProgressSection.style.display = "none";
});

// New Trade ડેટાબેઝ (task_nse) માં સેવ કરવા માટે
document.getElementById("save-new-btn").addEventListener("click", async () => {
  const date = document.getElementById("buy_date").value;
  const stock_name = document.getElementById("stock_name").value.trim().toUpperCase();
  const buy_price = parseFloat(document.getElementById("buy_price").value);
  const buy_qty = parseFloat(document.getElementById("buy_qty").value);
  const buy_charges = parseFloat(document.getElementById("buy_charges").value) || 0;

  if (!date || !stock_name || isNaN(buy_price) || isNaN(buy_qty)) {
    alert("કૃપા કરીને બધી જરૂરી વિગતો ભરો!");
    return;
  }

  const buy_amount = buy_price * buy_qty;

  const { data, error } = await supabaseClient
    .from("task_nse")
    .insert([
      {
        date: date,
        stock_name: stock_name,
        buy_price: buy_price,
        buy_qty: buy_qty,
        buy_charges: buy_charges,
        buy_amount: buy_amount
      }
    ]);

  if (error) {
    alert("ડેટા સેવ કરવામાં એરર આવી: " + error.message);
  } else {
    alert("નવો ટ્રેડ સફળતાપૂર્વક સેવ થઈ ગયો!");
    document.getElementById("stock_name").value = "";
    document.getElementById("buy_price").value = "";
    document.getElementById("buy_qty").value = "";
    document.getElementById("buy_charges").value = "";
  }
});

// 2) In Progress બટન પર ક્લિક કરતા
btnInProgress.addEventListener("click", async () => {
  newTradeForm.style.display = "none";
  inProgressSection.style.display = "block";
  sellTradeForm.style.display = "none";

  const pendingList = document.getElementById("pending-list");
  pendingList.innerHTML = "ડેટા લોડ થઈ રહ્યો છે...";

  // જ્યાં sell_price, sell_qty અને sell_charges ખાલી (null) હોય તેવા રેકોર્ડ લાવો
  const { data, error } = await supabaseClient
    .from("task_nse")
    .select("*")
    .is("sell_price", null)
    .is("sell_qty", null)
    .is("sell_charges", null)
    .order("sr_no", { ascending: false });

  if (error) {
    pendingList.innerHTML = "એરર: " + error.message;
    return;
  }

  if (data.length === 0) {
    pendingList.innerHTML = "<p>કોઈ In Progress ટ્રેડ બાકી નથી.</p>";
    return;
  }

  pendingList.innerHTML = "";
  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "pending-item";
    div.innerHTML = `<strong>${item.stock_name}</strong> — Buy Qty: ${item.buy_qty}`;

    // કોઈપણ એક સ્ટોક પર ક્લિક કરતા Sell ફોર્મ ખોલો
    div.addEventListener("click", () => {
      sellTradeForm.style.display = "block";
      document.getElementById("selected-stock-title").innerText = `Sell Entry: ${item.stock_name} (Buy Qty: ${item.buy_qty})`;
      document.getElementById("selected_sr_no").value = item.sr_no;
      document.getElementById("hidden_buy_amount").value = item.buy_amount;
      document.getElementById("hidden_buy_charges").value = item.buy_charges || 0;
      document.getElementById("sell_qty").value = item.buy_qty;
    });

    pendingList.appendChild(div);
  });
});

// Sell વિગતો અપડેટ કરવા માટે
document.getElementById("update-sell-btn").addEventListener("click", async () => {
  const sr_no = document.getElementById("selected_sr_no").value;
  const buy_amount = parseFloat(document.getElementById("hidden_buy_amount").value);
  const buy_charges = parseFloat(document.getElementById("hidden_buy_charges").value);

  const sell_price = parseFloat(document.getElementById("sell_price").value);
  const sell_qty = parseFloat(document.getElementById("sell_qty").value);
  const sell_charges = parseFloat(document.getElementById("sell_charges").value) || 0;

  if (isNaN(sell_price) || isNaN(sell_qty)) {
    alert("કૃપા કરીને Sell Price અને Sell Qty દાખલ કરો!");
    return;
  }

  const sell_amount = sell_price * sell_qty;
  const total_trn_amount = buy_amount + sell_amount;
  const total_charges = buy_charges + sell_charges;
  const gross_profit_loss = sell_amount - buy_amount;
  const net_profit_loss = gross_profit_loss - total_charges;

  const { data, error } = await supabaseClient
    .from("task_nse")
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
    .eq("sr_no", sr_no);

  if (error) {
    alert("અપડેટ કરવામાં એરર આવી: " + error.message);
  } else {
    alert(`ટ્રેડ પૂર્ણ થયો!\nNet Profit/Loss: ₹${net_profit_loss.toFixed(2)}`);
    document.getElementById("sell_price").value = "";
    document.getElementById("sell_charges").value = "";
    btnInProgress.click(); // લિસ્ટ રિફ્રેશ કરો
  }
});
