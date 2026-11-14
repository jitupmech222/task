const buttons = document.querySelectorAll(".nav-btn");
const statusText = document.getElementById("status-text");

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    buttons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    const name = button.textContent.trim();
    statusText.textContent = `${name} button selected. Functionality will be added later.`;
  });
});

// Supabase setup
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_SUPABASE_ANON_KEY";

const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Example: fetch data from Supabase
async function loadData() {
  const { data, error } = await supabase.from("your_table").select("*");

  if (error) {
    console.error("Supabase error:", error);
  } else {
    console.log("Data:", data);
  }
}

// Uncomment later when table is ready:
// loadData();