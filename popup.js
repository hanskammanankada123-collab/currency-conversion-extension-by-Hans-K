// Load saved currency into dropdown
chrome.storage.sync.get(["targetCurrency"], (data) => {
  const saved = data.targetCurrency || "NZD";
  document.getElementById("currencySelect").value = saved;
});

// Save new currency
document.getElementById("saveBtn").addEventListener("click", () => {
  const currency = document.getElementById("currencySelect").value;

  chrome.storage.sync.set({ targetCurrency: currency }, () => {
    alert("Saved! Reload the page to convert prices to " + currency);
  });
});
