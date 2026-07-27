let rates = null;
let TARGET = "NZD";

// Load user currency
chrome.storage.sync.get(["targetCurrency"], (data) => {
  TARGET = data.targetCurrency || "NZD";
});

// Convert LKR → target currency
function convertLKR(amount) {
  if (!rates) return null;

  const num = parseFloat(amount.replace(/,/g, ""));
  if (isNaN(num)) return null;

  const base = "LKR";

  if (!rates[base] || !rates[TARGET]) return null;

  const converted = num * (rates[TARGET] / rates[base]);
  return `${TARGET} ${converted.toFixed(2)} (${base}->${TARGET})`;
}

// Generic currency regex (for UNIQLO + others)
const currencyRegex =
  /(Rs\.?|Rs|₹|\$|€|£|¥|円|₩|₱|CHF|AUD|NZD|CAD|SGD|HKD|CNY|INR|SEK|NOK|DKK|ZAR|THB|KRW|PHP|MYR|IDR|VND|BRL|MXN|TRY|PLN|HUF|CZK|SAR|AED)[\s\u00A0]*([\d,]+(?:\.\d+)?)/gi;

// Detect base currency
function detectBase(symbol) {
  symbol = symbol.replace(/\./g, "");

  if (symbol.includes("Rs")) return "LKR";
  if (symbol === "₹") return "INR";
  if (symbol === "$") return "USD";
  if (symbol === "€") return "EUR";
  if (symbol === "£") return "GBP";
  if (symbol === "¥" || symbol === "円") return "JPY";

  const iso = [
    "CHF","AUD","NZD","CAD","SGD","HKD","CNY","INR","SEK","NOK","DKK",
    "ZAR","THB","KRW","PHP","MYR","IDR","VND","BRL","MXN","TRY","PLN",
    "HUF","CZK","SAR","AED"
  ];
  if (iso.includes(symbol)) return symbol;

  return "USD";
}

function convertGeneric(symbol, amount) {
  if (!rates) return null;

  const num = parseFloat(amount.replace(/,/g, ""));
  if (isNaN(num)) return null;

  const base = detectBase(symbol);
  if (!rates[base] || !rates[TARGET]) return null;

  const converted = num * (rates[TARGET] / rates[base]);
  return `${TARGET} ${converted.toFixed(2)} (${base}->${TARGET})`;
}

// CameraLK: split Rs + number + .00
function convertSplitPrice(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

  if (node.tagName === "SPAN" && node.textContent.trim() === "Rs") {
    const numNode = node.nextSibling;
    const decimalNode = numNode ? numNode.nextSibling : null;

    if (
      numNode &&
      numNode.nodeType === Node.TEXT_NODE &&
      /^[\d,]+$/.test(numNode.nodeValue.trim()) &&
      decimalNode &&
      decimalNode.tagName === "SPAN" &&
      /^\.\d+$/.test(decimalNode.textContent.trim())
    ) {
      const fullAmount =
        numNode.nodeValue.trim() + decimalNode.textContent.trim();

      const converted = convertLKR(fullAmount);
      if (converted) {
        numNode.nodeValue = converted;
        decimalNode.textContent = "";
      }
    }
  }
}

// Generic single-node prices (UNIQLO + others)
function convertNormal(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;

  let text = node.nodeValue;
  if (!text || text.includes("->")) return;

  text = text.replace(currencyRegex, (match, symbol, amount) => {
    const base = detectBase(symbol);
    const converted =
      base === "LKR" ? convertLKR(amount) : convertGeneric(symbol, amount);
    return converted ? converted : match;
  });

  node.nodeValue = text;
}

// Throttled conversion
let timer = null;

function throttledConvert() {
  if (timer) return;

  timer = setTimeout(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ALL);
    let node = walker.nextNode();

    while (node) {
      convertSplitPrice(node);  // CameraLK style
      convertNormal(node);      // UNIQLO + others
      node = walker.nextNode();
    }

    timer = null;
  }, 150);
}

// Observe dynamic changes (React/Vue/etc.)
function startObserver() {
  const observer = new MutationObserver(() => {
    throttledConvert();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

// Init
async function init() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const json = await res.json();
    rates = json.rates;

    startObserver();
    throttledConvert();
  } catch (e) {
    console.error("Failed to load rates:", e);
  }
}

init();
