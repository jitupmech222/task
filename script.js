// 1. અહીં તમારી Supabase URL અને ANON KEY નાખો
const SUPABASE_URL = 'તમારી_SUPABASE_URL_અહીં_પેસ્ટ_કરો';
const SUPABASE_KEY = 'તમારી_SUPABASE_ANON_KEY_અહીં_પેસ્ટ_કરો';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// બટનો અને સેક્શનના રેફરન્સ
const tradingBtn = document.getElementById('tradingBtn');
const optionSection = document.getElementById('optionSection');
const newBtn = document.getElementById('newBtn');
const inProgressBtn = document.getElementById('inProgressBtn');

const newFormSection = document.getElementById('newFormSection');
const inProgressSection = document.getElementById('inProgressSection');
const sellFormSection = document.getElementById('sellFormSection');

// Trading બટન દબાવતા વિકલ્પો બતાવો
tradingBtn.addEventListener('click', () => {
  optionSection.style.display = 'block';
  newFormSection.style.display = 'none';
  inProgressSection.style.display = 'none';
});

// 1) New વિકલ્પ પસંદ કરતા
newBtn.addEventListener('click', () => {
  newFormSection.style.display = 'block';
  inProgressSection.style.display = 'none';
});

// New Trade ડેટાબેઝમાં સેવ કરવા માટે
document.getElementById('saveNewBtn').addEventListener('click', async () => {
  const date = document.getElementById('buyDate').value;
  const stock_name = document.getElementById('stockName').value.trim().toUpperCase();
  const buy_price = parseFloat(document.getElementById('buyPrice').value);
  const buy_qty = parseFloat(document.getElementById('buyQty').value);
  const buy_charges = parseFloat(document.getElementById('buyCharges').value) || 0;

  if (!date || !stock_name || isNaN(buy_price) || isNaN(buy_qty)) {
    alert('કૃપા કરીને બધી જરૂરી વિગતો ભરો!');
    return;
  }

  // ગણતરી: buy_amount = buy_price * buy_qty
  const buy_amount = buy_price * buy_qty;

  const { data, error } = await supabase
    .from('task_nse')
    .insert([
      {
        date: date,
        stock_name: stock_name,
        buy_price: buy_price,
        buy_qty: buy_qty,
        buy_charges: buy_charges,
        buy_amount: buy_amount
        // sell_price, sell_qty, sell_charges આપમેળે NULL (ખાલી) રહેશે
      }
    ]);

  if (error) {
    alert('એરર આવી: ' + error.message);
  } else {
    alert('નવો ટ્રેડ સફળતાપૂર્વક સેવ થઈ ગયો!');
    // ફોર્મ ખાલી કરો
    document.getElementById('stockName').value = '';
    document.getElementById('buyPrice').value = '';
    document.getElementById('buyQty').value = '';
    document.getElementById('buyCharges').value = '';
  }
});

// 2) In Progress વિકલ્પ પસંદ કરતા (જ્યાં sell_price ખાલી હોય તેવા સ્ટોક બતાવો)
inProgressBtn.addEventListener('click', async () => {
  newFormSection.style.display = 'none';
  inProgressSection.style.display = 'block';
  sellFormSection.style.display = 'none';
  
  const pendingList = document.getElementById('pendingList');
  pendingList.innerHTML = 'ડેટા લોડ થઈ રહ્યો છે...';

  // ડેટાબેઝમાંથી એવા રેકોર્ડ લાવો જ્યાં sell_price, sell_qty અને sell_charges ખાલી (null) હોય
  const { data, error } = await supabase
    .from('task_nse')
    .select('*')
    .is('sell_price', null)
    .is('sell_qty', null)
    .is('sell_charges', null)
    .order('sr_no', { ascending: false });

  if (error) {
    pendingList.innerHTML = 'એરર: ' + error.message;
    return;
  }

  if (data.length === 0) {
    pendingList.innerHTML = '<p>કોઈ In Progress ટ્રેડ બાકી નથી.</p>';
    return;
  }

  pendingList.innerHTML = '';
  data.forEach(item => {
    const div = document.createElement('div');
    div.className = 'pending-item';
    div.innerHTML = `<strong>${item.stock_name}</strong> — Buy Qty: ${item.buy_qty} (Buy Price: ₹${item.buy_price})`;
    
    // કોઈપણ એક સ્ટોક પર ક્લિક કરતા Sell ફોર્મ ખોલો
    div.addEventListener('click', () => {
      sellFormSection.style.display = 'block';
      document.getElementById('selectedStockTitle').innerText = `Sell Entry: ${item.stock_name} (Buy Qty: ${item.buy_qty})`;
      document.getElementById('selectedSrNo').value = item.sr_no;
      document.getElementById('hiddenBuyAmount').value = item.buy_amount;
      document.getElementById('hiddenBuyCharges').value = item.buy_charges || 0;
      document.getElementById('sellQty').value = item.buy_qty; // સરળતા માટે default buy_qty મૂકી છે
    });

    pendingList.appendChild(div);
  });
});

// Sell વિગતો અપડેટ અને ગણતરી કરવા માટે
document.getElementById('updateSellBtn').addEventListener('click', async () => {
  const sr_no = document.getElementById('selectedSrNo').value;
  const buy_amount = parseFloat(document.getElementById('hiddenBuyAmount').value);
  const buy_charges = parseFloat(document.getElementById('hiddenBuyCharges').value);

  const sell_price = parseFloat(document.getElementById('sellPrice').value);
  const sell_qty = parseFloat(document.getElementById('sellQty').value);
  const sell_charges = parseFloat(document.getElementById('sellCharges').value) || 0;

  if (isNaN(sell_price) || isNaN(sell_qty)) {
    alert('કૃપા કરીને Sell Price અને Sell Qty દાખલ કરો!');
    return;
  }

  // તમારી આપેલી ફોર્મ્યુલા મુજબ ગણતરીઓ:
  const sell_amount = sell_price * sell_qty;
  const total_trn_amount = buy_amount + sell_amount;
  const total_charges = buy_charges + sell_charges;
  const gross_profit_loss = sell_amount - buy_amount;
  const net_profit_loss = gross_profit_loss - total_charges;

  const { data, error } = await supabase
    .from('task_nse')
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
    .eq('sr_no', sr_no);

  if (error) {
    alert('અપડેટ કરવામાં એરર આવી: ' + error.message);
  } else {
    alert(`ટ્રેડ પૂર્ણ થયો!\nNet Profit/Loss: ₹${net_profit_loss.toFixed(2)}`);
    // લિસ્ટ ફરીથી રિફ્રેશ કરો
    inProgressBtn.click();
  }
});
