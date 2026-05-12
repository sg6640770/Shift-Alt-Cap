let charts = {};
let currentTimeframes = {
  techGrowthChart: '1Y',            // Most Relevant (AIT)
  sustainableEnergyChart: '1Y'      // All Weather (ESS)
};

function setActiveTimeButton(button) {
  const siblings = button.parentNode.querySelectorAll("button");
  siblings.forEach(btn => btn.classList.remove("active"));
  button.classList.add("active");
}

/* =========================
   METRICS FUNCTIONS
========================= */

// AIT → Most Relevant → LEFT CARD
async function updateAITMetrics(timeline) {
  try {
    const response = await fetch('./weight/AIT_Portfolio_Performance.json?v=' + Date.now());
    if (!response.ok) throw new Error('Failed to fetch AIT metrics');

    const data = await response.json();

    if (data[timeline] && data[timeline]["ratios"]) {
      const r = data[timeline]["ratios"];

      document.getElementById('ait-metrics').innerHTML = `
        Return: ${r["Return"].toFixed(2)}% |
        Sharpe: ${r["Sharpe Ratio"].toFixed(2)} |
        Sortino: ${r["Sortino Ratio"].toFixed(2)} |
        Max Drawdown: ${r["Max Drawdown"].toFixed(2)}
      `;
    }
  } catch (error) {
    console.error("AIT metrics error:", error);
  }
}

// ESS → All Weather → RIGHT CARD
async function updateESSMetrics(timeline) {
  try {
    const response = await fetch('./weight/ESS_Portfolio_Performance.json?v=' + Date.now());
    if (!response.ok) throw new Error('Failed to fetch ESS metrics');

    const data = await response.json();

    if (data[timeline] && data[timeline]["ratios"]) {
      const r = data[timeline]["ratios"];

      document.getElementById('ess-metrics').innerHTML = `
        Return: ${r["Return"].toFixed(2)}% |
        Sharpe: ${r["Sharpe Ratio"].toFixed(2)} |
        Sortino: ${r["Sortino Ratio"].toFixed(2)} |
        Max Drawdown: ${r["Max Drawdown"].toFixed(2)}
      `;
    }
  } catch (error) {
    console.error("ESS metrics error:", error);
  }
}

/* =========================
   DATA FETCHING
========================= */

async function fetchSP500Data() {
  try {
    const response = await fetch('./weight/sp500_performance.json?v=' + Date.now());
    if (!response.ok) throw new Error("Failed to fetch S&P 500");
    return await response.json();
  } catch (error) {
    console.error("SP500 error:", error);
    return null;
  }
}

async function fetchNifty50Data() {
  try {
    const response = await fetch('./weight/nifty50_performance.json?v=' + Date.now());
    if (!response.ok) throw new Error("Failed to fetch NIFTY 50");
    return await response.json();
  } catch (error) {
    console.error("NIFTY error:", error);
    return null;
  }
}

async function fetchPortfolioData(portfolioFile) {
  try {
    const response = await fetch(`./weight/${portfolioFile}?v=` + Date.now());
    if (!response.ok) throw new Error(`Failed to fetch ${portfolioFile}`);
    return await response.json();
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    return null;
  }
}

function getCurrentTimeframe(chartId) {
  return currentTimeframes[chartId];
}

/* =========================
   MAIN CHART FUNCTION
========================= */

async function updateChart(chartId, timeframe) {
  currentTimeframes[chartId] = timeframe;

  // ✅ FINAL CORRECT MAPPING
  // LEFT → Most Relevant → AIT
  // RIGHT → All Weather → ESS
  const portfolioFile = chartId === 'techGrowthChart'
    ? 'AIT_Portfolio_Performance.json'
    : 'ESS_Portfolio_Performance.json';

  const portfolioData = await fetchPortfolioData(portfolioFile);
  const sp500Data = await fetchSP500Data();
  const nifty50Data = await fetchNifty50Data();

  if (!portfolioData || !portfolioData[timeframe]) {
    console.error(`No data for ${chartId}`);
    return;
  }

  if (charts[chartId]) {
    charts[chartId].destroy();
  }

  const ctx = document.getElementById(chartId).getContext('2d');
  const labels = portfolioData[timeframe].dates;

  let datasets = [
    {
      label: 'Portfolio Performance',
      data: portfolioData[timeframe].values,
      borderColor: 'black',
      backgroundColor: 'rgba(0, 51, 102, 0.1)',
      borderWidth: 2,
      fill: true,
      pointRadius: 3,
      tension: 0.4,
    }
  ];

  // S&P 500
  const showSP500 = document.getElementById(
    `toggleSP500${chartId === 'techGrowthChart' ? 'Tech' : 'Sustainable'}`
  ).checked;

  if (showSP500 && sp500Data && sp500Data[timeframe]) {
    datasets.push({
      label: 'S&P 500 Performance',
      data: sp500Data[timeframe].values.slice(0, labels.length),
      borderColor: 'red',
      borderWidth: 2,
      fill: false,
      pointRadius: 3,
      tension: 0.4
    });
  }

  // NIFTY 50
  const showNifty50 = document.getElementById(
    `toggleNifty50${chartId === 'techGrowthChart' ? 'Tech' : 'Sustainable'}`
  ).checked;

  if (showNifty50 && nifty50Data && nifty50Data[timeframe]) {
    datasets.push({
      label: 'NIFTY-50 Performance',
      data: nifty50Data[timeframe].values.slice(0, labels.length),
      borderColor: 'blue',
      borderWidth: 2,
      fill: false,
      pointRadius: 3,
      tension: 0.4
    });
  }

  charts[chartId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day' }
        },
        y: {
          beginAtZero: false
        }
      }
    }
  });

  // ✅ MATCH METRICS WITH GRAPH
  if (chartId === 'techGrowthChart') {
    updateAITMetrics(timeframe);  // LEFT
  } else {
    updateESSMetrics(timeframe);  // RIGHT
  }
}

/* =========================
   INITIAL LOAD + EVENTS
========================= */

document.addEventListener("DOMContentLoaded", function () {

  // Initial charts
  updateChart('techGrowthChart', '1Y');          // Most Relevant
  updateChart('sustainableEnergyChart', '1Y');   // All Weather

  // Toggle Metrics
  document.getElementById('toggleMetricsAIT').addEventListener('change', function (e) {
    document.getElementById('ait-metrics').style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked) updateAITMetrics(getCurrentTimeframe('techGrowthChart'));
  });

  document.getElementById('toggleMetricsESS').addEventListener('change', function (e) {
    document.getElementById('ess-metrics').style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked) updateESSMetrics(getCurrentTimeframe('sustainableEnergyChart'));
  });

  // Slider
  const slider = document.querySelector(".linkedin-slider");
  const prevArrow = document.querySelector(".prev-btn");
  const nextArrow = document.querySelector(".next-btn");

  if (slider && prevArrow && nextArrow) {
    let scrollAmount = 400;

    prevArrow.addEventListener("click", () => {
      slider.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });

    nextArrow.addEventListener("click", () => {
      slider.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
  }

  // FAQ
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(item => {
    item.addEventListener("click", function () {
      faqItems.forEach(i => { if (i !== item) i.classList.remove("active"); });
      item.classList.toggle("active");
    });
  });

});
