// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ચોક્કસ 2 દશાંશ સ્થળ સુધી રાઉન્ડ કરવાનું હેલ્પર ફંક્શન
function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

// SAHI બ્રોકરેજ અને ટેક્સ ગણતરી
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

const btnNew = document.getElementById("btn-new");
const btnInProgress = document.getElementById("btn-in-progress");
const newTradeForm = document.getElementById("new-trade-form");
const inProgressSection = document.getElementById("in-progress-section");
const completeTradeForm = document.getElementById("complete-trade-form");

const tradeSegmentSelect = document.getElementById("trade_segment");
const tradeSideSelect = document.getElementById("trade_side");
const firstPriceInput = document.getElementById("first_price");
const firstQtyInput = document.getElementById("first_qty");
const firstChargesInput = document.getElementById("first_charges");

function updateFirstAutoCharges() {
  const seg = tradeSegmentSelect.value;
  const side = tradeSideSelect.value;
  const price = parseFloat(firstPriceInput.value);
  const qty = parseFloat(firstQtyInput.value);
  firstChargesInput.value = calculateSahiCharges(seg, side, price, qty).toFixed(2);
}

tradeSegmentSelect.addEventListener("change", updateFirstAutoCharges);
firstPriceInput.addEventListener("input", updateFirstAutoCharges);
firstQtyInput.addEventListener("input", updateFirstAutoCharges);

tradeSideSelect.addEventListener("change", () => {
  const side = tradeSideSelect.value;
  if (side === "BUY") {
    document.getElementById("lbl_first_price").innerText = "Buy Price:";
    document.getElementById("lbl_first_qty").innerText = "Buy Qty:";
    document.getElementById("lbl_first_charges").innerText = "Buy Charges (Auto Calculated):";
  } else if (side === "SELL") {
    document.getElementById("lbl_first_price").innerText = "Sell Price:";
    document.getElementById("lbl_first_qty").innerText = "Sell Qty:";
    document.getElementById("lbl_first_charges").innerText = "Sell Charges (Auto Calculated):";
  } else {
    document.getElementById("lbl_first_price").innerText = "Price:";
    document.getElementById("lbl_first_qty").innerText = "Qty:";
    document.getElementById("lbl_first_charges").innerText = "Charges (Auto Calculated):";
  }
  updateFirstAutoCharges();
});

btnNew.addEventListener("click", () => {
  newTradeForm.style.display = "block";
  inProgressSection.style.display = "none";
});

document.getElementById("save-new-btn").addEventListener("click", async () => {
  const seg = tradeSegmentSelect.value;
  const side = tradeSideSelect.value;
  const date = document.getElementById("first_date").value;
  const stock_name = document.getElementById("stock_name").value.trim().toUpperCase();
  const price = round2(parseFloat(firstPriceInput.value));
  const qty = parseFloat(firstQtyInput.value);
  const charges = round2(parseFloat(firstChargesInput.value) || 0);

  if (!seg) {
    alert("કૃપા કરીને પહેલા Segment પસંદ કરો!");
    return;
  }

  if (!side) {
    alert("કૃપા કરીને Trade Type (BUY અથવા SELL) પસંદ કરો!");
    return;
  }

  if (!date || !stock_name || isNaN(price) || isNaN(qty)) {
    alert("કૃપા કરીને બધી જરૂરી વિગતો ભરો!");
    return;
  }

  const amount = round2(price * qty);
  const payload = { date: date, stock_name: stock_name };

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
    alert(`નવો ${side} ટ્રેડ (Charges: ₹${charges.toFixed(2)}) સફળતાપૂર્વક સેવ થઈ ગયો!`);
    tradeSegmentSelect.value = "";
    tradeSideSelect.value = "";
    document.getElementById("stock_name").value = "";
    firstPriceInput.value = "";
    firstQtyInput.value = "";
    firstChargesInput.value = "";
  }
});

const completeSegmentSelect = document.getElementById("complete_segment");
const secondPriceInput = document.getElementById("second_price");
const secondQtyInput = document.getElementById("second_qty");
const secondChargesInput = document.getElementById("second_charges");

function updateSecondAutoCharges() {
  const seg = completeSegmentSelect.value;
  const side = document.getElementById("missing_side").value;
  const price = parseFloat(secondPriceInput.value);
  const qty = parseFloat(secondQtyInput.value);
  secondChargesInput.value = calculateSahiCharges(seg, side, price, qty).toFixed(2);
}

completeSegmentSelect.addEventListener("change", updateSecondAutoCharges);
secondPriceInput.addEventListener("input", updateSecondAutoCharges);
secondQtyInput.addEventListener("input", updateSecondAutoCharges);

btnInProgress.addEventListener("click", async () => {
  newTradeForm.style.display = "none";
  inProgressSection.style.display = "block";
  completeTradeForm.style.display = "none";

  const pendingList = document.getElementById("pending-list");
  pendingList.innerHTML = "ડેટા લોડ થઈ રહ્યો છે...";

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
    div.innerHTML = `<strong>${item.stock_name}</strong> — [${doneSide}] Qty: ${doneQty} | Price: ₹${Number(donePrice).toFixed(2)}`;

    div.addEventListener("click", () => {
      completeTradeForm.style.display = "block";
      document.getElementById("selected-stock-title").innerText = `Complete ${missingSide} Entry: ${item.stock_name} ([${doneSide}] Qty: ${doneQty} @ ₹${Number(donePrice).toFixed(2)})`;
      document.getElementById("lbl_second_price").innerText = `${missingSide} Price:`;
      document.getElementById("lbl_second_qty").innerText = `${missingSide} Qty:`;
      document.getElementById("lbl_second_charges").innerText = `${missingSide} Charges (Auto Calculated):`;

      completeSegmentSelect.value = "";
      document.getElementById("selected_sr_no").value = item.sr_no;
      document.getElementById("missing_side").value = missingSide;
      document.getElementById("hidden_existing_amount").value = isBuyDone ? item.buy_amount : item.sell_amount;
      document.getElementById("hidden_existing_charges").value = isBuyDone ? (item.buy_charges || 0) : (item.sell_charges || 0);
      secondQtyInput.value = doneQty;
      secondPriceInput.value = "";
      secondChargesInput.value = "";
    });

    pendingList.appendChild(div);
  });
});

document.getElementById("update-complete-btn").addEventListener("click", async () => {
  const seg = completeSegmentSelect.value;
  const sr_no = document.getElementById("selected_sr_no").value;
  const missingSide = document.getElementById("missing_side").value;
  const existingAmount = round2(parseFloat(document.getElementById("hidden_existing_amount").value));
  const existingCharges = round2(parseFloat(document.getElementById("hidden_existing_charges").value));

  const secondPrice = round2(parseFloat(secondPriceInput.value));
  const secondQty = parseFloat(secondQtyInput.value);
  const secondCharges = round2(parseFloat(secondChargesInput.value) || 0);

  if (!seg) {
    alert("કૃપા કરીને પહેલા Segment પસંદ કરો!");
    return;
  }

  if (isNaN(secondPrice) || isNaN(secondQty)) {
    alert("કૃપા કરીને Price અને Qty દાખલ કરો!");
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

  const { error } = await supabaseClient
    .from("task_nse")
    .update(updatePayload)
    .eq("sr_no", sr_no);

  if (error) {
    alert("અપડેટ કરવામાં એરર આવી: " + error.message);
  } else {
    alert(`ટ્રેડ પૂર્ણ થયો!\nTotal Charges: ₹${total_charges.toFixed(2)}\nNet Profit/Loss: ₹${net_profit_loss.toFixed(2)}`);
    secondPriceInput.value = "";
    secondChargesInput.value = "";
    btnInProgress.click();
  }
});
