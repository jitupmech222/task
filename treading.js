// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const btnNew = document.getElementById("btn-new");
const btnInProgress = document.getElementById("btn-in-progress");
const newTradeForm = document.getElementById("new-trade-form");
const inProgressSection = document.getElementById("in-progress-section");
const completeTradeForm = document.getElementById("complete-trade-form");
const tradeSideSelect = document.getElementById("trade_side");

// BUY અથવા SELL પસંદ કરતા ફોર્મના લેબલ બદલો
tradeSideSelect.addEventListener("change", () => {
  const side = tradeSideSelect.value;
  if (side === "BUY") {
    document.getElementById("lbl_first_price").innerText = "Buy Price:";
    document.getElementById("lbl_first_qty").innerText = "Buy Qty:";
    document.getElementById("lbl_first_charges").innerText = "Buy Charges:";
  } else {
    document.getElementById("lbl_first_price").innerText = "Sell Price:";
    document.getElementById("lbl_first_qty").innerText = "Sell Qty:";
    document.getElementById("lbl_first_charges").innerText = "Sell Charges:";
  }
});

// 1) New બટન પર ક્લિક કરતા
btnNew.addEventListener("click", () => {
  newTradeForm.style.display = "block";
  inProgressSection.style.display = "none";
});

// પ્રથમ એન્ટ્રી (BUY અથવા SELL) ડેટાબેઝ (task_nse) માં સેવ કરવા માટે
document.getElementById("save-new-btn").addEventListener("click", async () => {
  const side = tradeSideSelect.value; // "BUY" અથવા "SELL"
  const date = document.getElementById("first_date").value;
  const stock_name = document.getElementById("stock_name").value.trim().toUpperCase();
  const price = parseFloat(document.getElementById("first_price").value);
  const qty = parseFloat(document.getElementById("first_qty").value);
  const charges = parseFloat(document.getElementById("first_charges").value) || 0;

  if (!date || !stock_name || isNaN(price) || isNaN(qty)) {
    alert("કૃપા કરીને બધી જરૂરી વિગતો ભરો!");
    return;
  }

  const amount = price * qty;

  const payload = {
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

  const { error } = await supabaseClient.from("task_nse").insert([payload]);

  if (error) {
    alert("ડેટા સેવ કરવામાં એરર આવી: " + error.message);
  } else {
    alert(`નવો ${side} ટ્રેડ સફળતાપૂર્વક સેવ થઈ ગયો!`);
    document.getElementById("stock_name").value = "";
    document.getElementById("first_price").value = "";
    document.getElementById("first_qty").value = "";
    document.getElementById("first_charges").value = "";
  }
});

// 2) In Progress બટન પર ક્લિક કરતા
btnInProgress.addEventListener("click", async () => {
  newTradeForm.style.display = "none";
  inProgressSection.style.display = "block";
  completeTradeForm.style.display = "none";

  const pendingList = document.getElementById("pending-list");
  pendingList.innerHTML = "ડેટા લોડ થઈ રહ્યો છે...";

  // જ્યાં buy_price અથવા sell_price બંનેમાંથી કોઈ એક ખાલી (null) હોય તેવા રેકોર્ડ લાવો
  const { data, error } = await supabaseClient
    .from("task_nse")
    .select("*")
    .or("buy_price.is.null,sell_price.is.null")
    .order("sr_no", { ascending: false });

  if (error) {
    pendingList.innerHTML = "એરર: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    pendingList.innerHTML = "<p>કોઈ In Progress ટ્રેડ બાકી નથી.</p>";
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
    div.innerHTML = `<strong>${item.stock_name}</strong> — [${doneSide}] Qty: ${doneQty} | Price: ₹${donePrice}`;

    // કોઈપણ એક સ્ટોક પર ક્લિક કરતા બાકી રહેલી એન્ટ્રી (SELL અથવા BUY) નું ફોર્મ ખોલો
    div.addEventListener("click", () => {
      completeTradeForm.style.display = "block";
      document.getElementById("selected-stock-title").innerText = `Complete ${missingSide} Entry: ${item.stock_name} ([${doneSide}] Qty: ${doneQty} @ ₹${donePrice})`;
      document.getElementById("lbl_second_price").innerText = `${missingSide} Price:`;
      document.getElementById("lbl_second_qty").innerText = `${missingSide} Qty:`;
      document.getElementById("lbl_second_charges").innerText = `${missingSide} Charges:`;

      document.getElementById("selected_sr_no").value = item.sr_no;
      document.getElementById("missing_side").value = missingSide;
      document.getElementById("hidden_existing_amount").value = isBuyDone ? item.buy_amount : item.sell_amount;
      document.getElementById("hidden_existing_charges").value = isBuyDone ? (item.buy_charges || 0) : (item.sell_charges || 0);
      document.getElementById("second_qty").value = doneQty;
    });

    pendingList.appendChild(div);
  });
});

// બીજી બાજુ (SELL અથવા BUY) અપડેટ કરીને ટ્રેડ પૂર્ણ કરવા માટે
document.getElementById("update-complete-btn").addEventListener("click", async () => {
  const sr_no = document.getElementById("selected_sr_no").value;
  const missingSide = document.getElementById("missing_side").value; // "SELL" અથવા "BUY"
  const existingAmount = parseFloat(document.getElementById("hidden_existing_amount").value);
  const existingCharges = parseFloat(document.getElementById("hidden_existing_charges").value);

  const secondPrice = parseFloat(document.getElementById("second_price").value);
  const secondQty = parseFloat(document.getElementById("second_qty").value);
  const secondCharges = parseFloat(document.getElementById("second_charges").value) || 0;

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

  const { error } = await supabaseClient
    .from("task_nse")
    .update(updatePayload)
    .eq("sr_no", sr_no);

  if (error) {
    alert("અપડેટ કરવામાં એરર આવી: " + error.message);
  } else {
    alert(`ટ્રેડ પૂર્ણ થયો!\nNet Profit/Loss: ₹${net_profit_loss.toFixed(2)}`);
    document.getElementById("second_price").value = "";
    document.getElementById("second_charges").value = "";
    btnInProgress.click(); // લિસ્ટ રિફ્રેશ કરો
  }
});
