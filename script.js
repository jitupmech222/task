const buttons = document.querySelectorAll(".nav-btn");
const statusText = document.getElementById("status-text");

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    buttons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    const name = button.textContent.trim();

    if (name === "Treading") {
      window.location.href = "treading.html";
    } else if (name === "Report") {
      window.location.href = "report.html";
    } else if (name === "Data") {
      // Data બટન દબાવતા Data પેજ ખોલો
      window.location.href = "data.html";
    } else {
      statusText.textContent = `${name} button selected. Functionality will be added later.`;
    }
  });
});
