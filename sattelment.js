// Supabase setup
const supabaseUrl = "https://bgfwwhivzgzzchhkgkqr.supabase.co";
const supabaseKey = "sb_publishable_8YLsit4SKIqzKowkIBLitw_QN3D4RxK";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const tbody = document.getElementById("sattelment-tbody");
const lastInfo = document.getElementById("last-sattelment-info");

// પેજ ખુલતા જ બાકી રહેલા Sattelment રેકોર્ડ લોડ કરો
async function loadPendingSattelments() {
  tbody.innerHTML = '<tr><td colspan="6">ડેટા લોડ થઈ રહ્યો છે...</td></tr>';

  // 1. છેલ્લું થયેલું સેટલમેન્ટ ચેક કરો (સૌથી મોટો sattelment નંબર)
  const { data: settledRows } = await supabaseClient
    .from("task_nse")
    .select("sattelment, closing_balance")
    .not("sattelment", "is", null)
    .order("sattelment", { ascending: false })
    .limit(1);

  if (settledRows && settledRows.length > 0) {
    lastInfo.innerText = `Last Sattelment: #${settledRows[0].sattelment} | Closing Bal: ₹${settledRows[0].closing_balance}`;
  } else {
    lastInfo.innerText = "Last Sattelment: None (First Time)";
  }

  // 2. એવા રેકોર્ડ લાવો જ્યાં opening_balance અથવા closing_balance બંને અથવા કોઈ એક ખાલી (null) હોય
  const { data, error } = await supabaseClient
    .from("task_nse")
    .select("*")
    .or("opening_balance.is.null,closing_balance.is.null")
    .order("sr_no", { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red;">એરર આવી: ${error.message}</td></tr>`;
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">કોઈ Sattelment બાકી નથી.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  data.forEach((row) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.sr_no}</td>
      <td>${row.date || "-"}</td>
      <td><strong>${row.stock_name || "-"}</strong></td>
      <td>${row.opening_balance !== null ? row.opening_balance : "-"}</td>
      <td>${row.closing_balance !== null ? row.closing_balance : "-"}</td>
      <td>
        <button type="button" class="mini-btn" style="background-color: #16a34a;" onclick="processSattelment(${row.sr_no})">
          Settlement
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// Action માં 'Settlement' બટન દબાવતા ચાલતું ફંક્શન
async function processSattelment(srNo) {
  // 1. પસંદ કરેલી રો નો તાજો ડેટા ડેટાબેઝમાંથી લાવો
  const { data: currentRow, error: fetchErr } = await supabaseClient
    .from("task_nse")
    .select("*")
    .eq("sr_no", srNo)
    .single();

  if (fetchErr || !currentRow) {
    alert("ડેટા મેળવવામાં એરર આવી!");
    return;
  }

  // 2. ચેક કરો કે net_profit_loss ભરેલું છે કે ખાલી
  if (currentRow.net_profit_loss === null || currentRow.net_profit_loss === undefined || currentRow.net_profit_loss === "") {
    alert("Please fill net_profit_loss");
    return;
  }

  const netPL = parseFloat(currentRow.net_profit_loss);

  // 3. ડેટાબેઝમાં છેલ્લું (સૌથી મોટું) sattelment ચેક કરો
  const { data: lastSettled, error: lastErr } = await supabaseClient
    .from("task_nse")
    .select("sattelment, closing_balance")
    .not("sattelment", "is", null)
    .order("sattelment", { ascending: false })
    .limit(1);

  if (lastErr) {
    alert("અગાઉનું સેટલમેન્ટ ચેક કરવામાં એરર આવી: " + lastErr.message);
    return;
  }

  let newSattelmentNo = 1;
  let openingBal = 0;

  if (lastSettled && lastSettled.length > 0) {
    // જો અગાઉ સેટલમેન્ટ થયેલું હોય (દા.ત. 1), તો નવો નંબર 2 થશે અને અગાઉનું closing_balance અહીં opening_balance બનશે
    newSattelmentNo = Number(lastSettled[0].sattelment) + 1;
    openingBal = parseFloat(lastSettled[0].closing_balance) || 0;
  } else {
    // જો આ પહેલું જ સેટલમેન્ટ (1) હોય
    newSattelmentNo = 1;
    if (currentRow.opening_balance !== null && currentRow.opening_balance !== undefined) {
      openingBal = parseFloat(currentRow.opening_balance);
    } else {
      // જો પહેલા સેટલમેન્ટમાં opening_balance ખાલી હોય તો યુઝર પાસેથી પૂછી લો
      const userOpening = prompt("આ પહેલું સેટલમેન્ટ છે. કૃપા કરીને Opening Balance દાખલ કરો:", "0");
      if (userOpening === null) return; // Cancel દબાવે તો અટકી જાઓ
      openingBal = parseFloat(userOpening) || 0;
    }
  }

  // 4. ગણતરી: closing_balance = opening_balance + net_profit_loss
  const closingBal = openingBal + netPL;

  // 5. ડેટાબેઝમાં અપડેટ કરો
  const { error: updateErr } = await supabaseClient
    .from("task_nse")
    .update({
      opening_balance: openingBal,
      closing_balance: closingBal,
      sattelment: newSattelmentNo
    })
    .eq("sr_no", srNo);

  if (updateErr) {
    alert("સેટલમેન્ટ સેવ કરવામાં એરર આવી: " + updateErr.message);
  } else {
    alert(
      `Sattelment #${newSattelmentNo} પૂર્ણ થયું!\n` +
      `Opening Balance: ₹${openingBal.toFixed(2)}\n` +
      `Net P/L: ₹${netPL.toFixed(2)}\n` +
      `Closing Balance: ₹${closingBal.toFixed(2)}`
    );
    // ટેબલ ફરીથી રિફ્રેશ કરો
    loadPendingSattelments();
  }
}

// પેજ લોડ થતા ડેટા મંગાવો
loadPendingSattelments();
