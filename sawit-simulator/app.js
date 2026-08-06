(() => {
  "use strict";

  const SAVE_KEY = "sawit-simulator-save-v1";
  const seedPrice = 120_000;
  const compostPrice = 120_000;
  const processCost = 180_000;
  const batchFfb = 4.2;
  const batchCpo = 1;
  const maxPlots = 16;

  const weatherTypes = [
    { id: "sunny", icon: "☀", name: "Cerah", note: "+10% growth", growth: 1.1 },
    { id: "cloudy", icon: "☁", name: "Berawan", note: "steady growth", growth: 1 },
    { id: "rain", icon: "☂", name: "Hujan", note: "+20% growth", growth: 1.2 },
    { id: "dry", icon: "◌", name: "Kemarau", note: "−20% growth", growth: .8 },
  ];

  const landCatalog = [
    { id: "starter", name: "Kebun Sungai Hijau", tag: "Owned", price: 0, plots: 4, rep: 0, stewardship: 0, yield: "Standard", description: "Your family smallholding and the heart of your new business.", x: 64, y: 62 },
    { id: "bukit", name: "Bukit Sari Lease", tag: "10-year lease", price: 6_500_000, plots: 4, rep: 5, stewardship: 0, yield: "+5%", description: "Sunny hillside terraces with rich soil and an existing farm road.", x: 77, y: 28 },
    { id: "riverside", name: "Koperasi Riverside", tag: "Co-op partnership", price: 12_000_000, plots: 4, rep: 15, stewardship: 60, yield: "+10%", description: "Partner with local growers and share access to fertile riverside land.", x: 48, y: 35 },
    { id: "tanah", name: "Tanah Merah Estate", tag: "Premium parcel", price: 22_000_000, plots: 4, rep: 30, stewardship: 75, yield: "+15%", description: "A large established parcel reserved for trusted valley stewards.", x: 86, y: 67 },
  ];

  const jobs = [
    { id: "harvest", icon: "🟠", eyebrow: "Reflex challenge", name: "Fruit Sorter", description: "Catch ripe fruit bunches before the loading bell rings.", pay: 400_000, time: "15 sec" },
    { id: "math", icon: "🧮", eyebrow: "Market challenge", name: "Trader’s Desk", description: "Read the numbers and choose the smartest deal for the co-op.", pay: 350_000, time: "1 question" },
    { id: "delivery", icon: "🛵", eyebrow: "Route challenge", name: "Village Delivery", description: "Pick the best route for today’s weather and deliver seedlings.", pay: 300_000, time: "1 route" },
  ];

  const questCatalog = [
    { id: "roots", icon: "🌱", name: "Put Down Roots", description: "Plant 3 oil palm seedlings.", goal: 3, metric: s => s.stats.planted, reward: 450_000, rep: 2 },
    { id: "harvest", icon: "🟠", name: "Buah Pertama", description: "Harvest your first mature plot.", goal: 1, metric: s => s.stats.harvests, reward: 600_000, rep: 3 },
    { id: "mill", icon: "♨", name: "Golden Flow", description: "Process your first batch of CPO.", goal: 1, metric: s => s.stats.batches, reward: 750_000, rep: 3 },
    { id: "helper", icon: "✦", name: "Helping Hands", description: "Complete 3 side jobs.", goal: 3, metric: s => s.stats.jobs, reward: 650_000, rep: 4 },
    { id: "expand", icon: "◇", name: "Room to Grow", description: "Secure one new land agreement.", goal: 2, metric: s => s.ownedLands.length, reward: 1_500_000, rep: 6 },
    { id: "steward", icon: "♥", name: "Trusted Steward", description: "Raise stewardship to 70.", goal: 70, metric: s => stewardshipScore(s), reward: 1_250_000, rep: 8 },
    { id: "trader", icon: "↗", name: "Pasar Pro", description: "Earn Rp20m in CPO sales.", goal: 20_000_000, metric: s => s.stats.salesRevenue, reward: 2_000_000, rep: 10 },
  ];

  let state;
  let activeQuestFilter = "active";
  let jobTimer = null;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const el = id => document.getElementById(id);

  function newState(name = "Raka") {
    return {
      version: 1,
      playerName: name,
      day: 1,
      money: 5_250_000,
      reputation: 3,
      weather: "sunny",
      seedlings: 3,
      ffb: 0,
      cpo: 0,
      ownedLands: ["starter"],
      plots: Array.from({ length: maxPlots }, (_, i) => ({ id: i, status: "empty", growth: 0, cared: false })),
      marketHistory: [10_850_000, 11_120_000, 10_940_000, 11_380_000, 11_240_000, 11_560_000, 11_840_000],
      stewardship: { soil: 58, water: 64, community: 52 },
      jobsToday: { harvest: false, math: false, delivery: false },
      focus: { field: false, job: false, mill: false },
      completedQuests: [],
      ledger: [
        { day: 1, description: "Smallholder starter grant", type: "Income", amount: 5_250_000 },
      ],
      stats: { planted: 0, harvests: 0, batches: 0, jobs: 0, salesRevenue: 0, totalExpenses: 0, totalIncome: 5_250_000 },
    };
  }

  function formatRp(value, compact = false) {
    const abs = Math.abs(Math.round(value));
    if (compact && abs >= 1_000_000_000) return `${value < 0 ? "−" : ""}Rp${(abs / 1_000_000_000).toFixed(1)}b`;
    if (compact && abs >= 1_000_000) return `${value < 0 ? "−" : ""}Rp${(abs / 1_000_000).toFixed(abs % 1_000_000 ? 1 : 0)}m`;
    if (compact && abs >= 1_000) return `${value < 0 ? "−" : ""}Rp${Math.round(abs / 1_000)}k`;
    return `${value < 0 ? "−" : ""}Rp${abs.toLocaleString("id-ID")}`;
  }

  function currentWeather() { return weatherTypes.find(w => w.id === state.weather) || weatherTypes[0]; }
  function capacity() { return state.ownedLands.length * 4; }
  function currentPrice() { return state.marketHistory[state.marketHistory.length - 1]; }
  function stewardshipScore(s = state) { return Math.round((s.stewardship.soil + s.stewardship.water + s.stewardship.community) / 3); }
  function clamp(value, min = 0, max = 100) { return Math.min(max, Math.max(min, value)); }

  function saveGame(showState = true) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (showState && el("saveState")) {
      el("saveState").textContent = "Saving…";
      setTimeout(() => { if (el("saveState")) el("saveState").textContent = "Saved locally"; }, 450);
    }
  }

  function loadGame() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!parsed || parsed.version !== 1) return null;
      return parsed;
    } catch { return null; }
  }

  function transact(description, amount, type) {
    state.money += amount;
    state.ledger.unshift({ day: state.day, description, type, amount });
    if (state.ledger.length > 80) state.ledger.pop();
    if (amount > 0) state.stats.totalIncome += amount;
    else state.stats.totalExpenses += Math.abs(amount);
  }

  function toast(message, type = "normal") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.innerHTML = `<span>${type === "error" ? "!" : type === "success" ? "✓" : "•"}</span><div>${message}</div>`;
    el("toastStack").appendChild(node);
    setTimeout(() => node.remove(), 3400);
  }

  function openModal(html, dismissible = true) {
    el("modalContent").innerHTML = html;
    el("modalClose").classList.toggle("is-hidden", !dismissible);
    el("modalLayer").classList.remove("is-hidden");
  }

  function closeModal() { el("modalLayer").classList.add("is-hidden"); }

  function showOnboarding() {
    openModal(`
      <p class="eyebrow">Welcome to the valley</p>
      <h2>Your kebun,<br />your story.</h2>
      <p>You have four open plots, three seedlings, and a smallholder grant. What should the neighbors call you?</p>
      <label class="eyebrow" for="playerNameInput">Your name</label>
      <input class="name-input" id="playerNameInput" maxlength="18" value="${state.playerName}" autocomplete="off" />
      <div class="modal-actions"><button class="button button--dark" id="beginBtn">Begin day one →</button></div>
    `, false);
    el("beginBtn").addEventListener("click", () => {
      const name = el("playerNameInput").value.trim();
      state.playerName = name || "Raka";
      closeModal();
      saveGame();
      renderAll();
      toast("Welcome to Sungai Hijau. Plant your first seedling!", "success");
    });
  }

  function startGame(isNew) {
    state = isNew ? newState() : loadGame();
    if (!state) state = newState();
    el("startScreen").classList.add("is-hidden");
    el("appShell").classList.remove("is-hidden");
    renderAll();
    if (isNew) showOnboarding();
  }

  function goTo(tab) {
    $$(".nav-item").forEach(n => n.classList.toggle("is-active", n.dataset.tab === tab));
    $$(".tab-page").forEach(p => p.classList.toggle("is-active", p.dataset.page === tab));
    el("sidebar").classList.remove("is-open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderAll();
  }

  function renderAll() {
    renderTopbar();
    renderOverview();
    renderPlantation();
    renderMarket();
    renderLands();
    renderJobs();
    renderQuests();
    renderLedger();
    checkQuests();
    saveGame(false);
  }

  function renderTopbar() {
    const weather = currentWeather();
    el("weatherIcon").textContent = weather.icon;
    el("weatherLabel").textContent = `${weather.name} · ${weather.note}`;
    el("dayLabel").textContent = `Day ${state.day} · 07:00`;
    el("moneyTop").textContent = formatRp(state.money, true);
    el("repTop").textContent = `${state.reputation} · ${reputationTitle()}`;
    const ready = state.plots.slice(0, capacity()).filter(p => p.status === "ready").length;
    el("farmBadge").textContent = ready || "";
    const jobsLeft = jobs.filter(j => !state.jobsToday[j.id]).length;
    el("jobBadge").textContent = jobsLeft || "";
    const activeQuests = questCatalog.filter(q => !state.completedQuests.includes(q.id) && q.metric(state) >= q.goal).length;
    el("questBadge").textContent = activeQuests || "";
  }

  function reputationTitle() {
    if (state.reputation >= 35) return "Valley leader";
    if (state.reputation >= 20) return "Trusted grower";
    if (state.reputation >= 8) return "Good neighbor";
    return "New grower";
  }

  function renderOverview() {
    el("playerName").textContent = state.playerName;
    const planted = state.plots.slice(0, capacity()).filter(p => p.status !== "empty").length;
    const ready = state.plots.slice(0, capacity()).filter(p => p.status === "ready").length;
    const estateXp = Math.min(100, Math.round((state.stats.salesRevenue / 30_000_000) * 50 + state.ownedLands.length * 12));
    const level = state.ownedLands.length >= 4 ? "4 · Valley Estate" : state.ownedLands.length >= 3 ? "3 · Established Grower" : state.ownedLands.length >= 2 ? "2 · Growing Kebun" : "1 · Smallholder";
    el("estateLevel").textContent = `Level ${level}`;
    el("estateProgress").style.width = `${estateXp}%`;
    el("plotsSummary").textContent = `${planted} of ${capacity()} plots planted`;
    if (ready) {
      el("heroHeadline").innerHTML = `${ready} plot${ready > 1 ? "s are" : " is"}<br />ready to harvest.`;
      el("heroCopy").textContent = "Fresh fruit bunches are waiting in the field. Harvest them before advancing the day.";
    } else {
      el("heroHeadline").innerHTML = "Your next harvest<br />starts here.";
      el("heroCopy").textContent = "Plant your open plots, care for the soil, and build a business the valley can be proud of.";
    }

    const delta = currentPrice() - state.marketHistory[state.marketHistory.length - 2];
    const pct = (delta / state.marketHistory[state.marketHistory.length - 2]) * 100;
    el("marketPrice").textContent = formatRp(currentPrice(), true);
    el("marketTrend").textContent = `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
    el("marketTrend").classList.toggle("is-down", pct < 0);
    el("marketTip").textContent = pct >= 1.5 ? "Strong demand today. A good time to sell." : pct < -1.5 ? "The market dipped. Holding stock may pay off." : "Prices are steady across the district.";
    el("sparkline").innerHTML = chartSvg(state.marketHistory, 280, 90);

    el("operationStats").innerHTML = [
      ["Available plots", `${capacity() - planted} / ${capacity()}`, "♣"],
      ["Fresh fruit bunches", `${state.ffb.toFixed(2)} t`, "●"],
      ["CPO in storage", `${state.cpo.toFixed(2)} t`, "◆"],
      ["Land agreements", state.ownedLands.length, "◇"],
    ].map(([label, value, icon]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong><i>${icon}</i></article>`).join("");

    const focus = [
      { id: "field", icon: "♣", name: "Visit the fields", copy: "Plant or tend a plot", page: "plantation" },
      { id: "job", icon: "✦", name: "Help a neighbor", copy: "Complete one side job", page: "jobs" },
      { id: "mill", icon: "♨", name: "Use the community mill", copy: "Process a batch when ready", page: "market" },
    ];
    const left = focus.filter(f => !state.focus[f.id]).length;
    el("focusCount").textContent = `${left} left`;
    el("focusList").innerHTML = focus.map(f => `<div class="focus-item ${state.focus[f.id] ? "is-done" : ""}"><span>${state.focus[f.id] ? "✓" : f.icon}</span><div><b>${f.name}</b><small>${f.copy}</small></div>${state.focus[f.id] ? "" : `<button data-go="${f.page}" aria-label="Go to ${f.name}">→</button>`}</div>`).join("");

    const score = stewardshipScore();
    el("stewardScore").textContent = score;
    ["soil", "water", "community"].forEach(key => {
      el(`${key}Score`).textContent = state.stewardship[key];
      el(`${key}Meter`).style.width = `${state.stewardship[key]}%`;
    });
  }

  function chartSvg(values, width, height) {
    const min = Math.min(...values) * .985;
    const max = Math.max(...values) * 1.015;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / (max - min || 1)) * height;
      return [x, y];
    });
    const line = points.map(p => p.join(",")).join(" ");
    const area = `0,${height} ${line} ${width},${height}`;
    const last = points[points.length - 1];
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7da572" stop-opacity=".32"/><stop offset="1" stop-color="#7da572" stop-opacity="0"/></linearGradient></defs><polygon points="${area}" fill="url(#chartFill)"/><polyline points="${line}" fill="none" stroke="#4e7c5c" stroke-width="2.2" vector-effect="non-scaling-stroke"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#f2bc58" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function renderPlantation() {
    el("seedPriceLabel").textContent = formatRp(seedPrice, true);
    const weather = currentWeather();
    el("fieldWeather").textContent = `${weather.icon} ${weather.name} · ${weather.note}`;
    el("plotGrid").innerHTML = state.plots.map((plot, index) => {
      const locked = index >= capacity();
      if (locked) return `<button class="plot locked" data-plot="${index}"><span class="plot-number">PLOT ${String(index + 1).padStart(2, "0")}</span><span class="plot-icon">🔒</span><b>Needs more land</b><small>Visit the Land Office</small></button>`;
      if (plot.status === "empty") return `<button class="plot empty" data-plot="${index}"><span class="plot-number">PLOT ${String(index + 1).padStart(2, "0")}</span><span class="plot-icon">＋</span><b>Open plot</b><small>${state.seedlings ? "Plant one seedling" : "Buy a seedling first"}</small></button>`;
      const ready = plot.status === "ready";
      return `<button class="plot ${ready ? "ready" : "growing"}" data-plot="${index}"><span class="plot-number">PLOT ${String(index + 1).padStart(2, "0")}</span><span class="plot-icon">🌴</span><b>${ready ? "Ready to harvest" : "Young oil palm"}</b><small>${ready ? "Tap to collect TBS" : `${Math.round(plot.growth)}% grown${plot.cared ? " · composted" : ""}`}</small>${ready ? "" : `<span class="plot-progress"><i style="width:${plot.growth}%"></i></span>`}</button>`;
    }).join("");
    el("plantAllBtn").disabled = !state.seedlings || !state.plots.slice(0, capacity()).some(p => p.status === "empty");
    el("farmInventory").innerHTML = [
      ["🌱", "Seedlings", "Ready to plant", state.seedlings],
      ["🟠", "Fresh fruit bunches", "TBS harvest", `${state.ffb.toFixed(2)} t`],
      ["◆", "Crude palm oil", "Processed stock", `${state.cpo.toFixed(2)} t`],
    ].map(([icon, name, copy, value]) => `<div class="inventory-row"><i>${icon}</i><div><b>${name}</b><small>${copy}</small></div><strong>${value}</strong></div>`).join("");
    const growing = state.plots.slice(0, capacity()).some(p => p.status === "growing");
    const already = state.plots.slice(0, capacity()).filter(p => p.status === "growing").every(p => p.cared);
    el("compostBtn").disabled = !growing || already || state.money < compostPrice;
    el("compostBtn").textContent = already && growing ? "Compost applied today ✓" : `Apply compost · ${formatRp(compostPrice, true)}`;
  }

  function handlePlot(index) {
    if (index >= capacity()) { goTo("lands"); toast("Secure another land agreement to unlock this plot."); return; }
    const plot = state.plots[index];
    if (plot.status === "empty") plantPlot(index);
    else if (plot.status === "ready") harvestPlot(index);
    else openModal(`<p class="eyebrow">Plot ${String(index + 1).padStart(2, "0")}</p><h2>Young oil palm</h2><p>This palm is <b>${Math.round(plot.growth)}% grown</b>. ${plot.cared ? "It has been composted and is thriving." : "Apply compost from the field panel to support the soil and speed up growth."}</p><div class="progress" style="height:8px"><i style="width:${plot.growth}%"></i></div><div class="modal-actions"><button class="button button--cream" id="modalOkay">Back to field</button></div>`);
    if (el("modalOkay")) el("modalOkay").onclick = closeModal;
  }

  function plantPlot(index) {
    if (!state.seedlings) { toast("You need a seedling. Buy one from the field toolbar.", "error"); return; }
    const plot = state.plots[index];
    plot.status = "growing";
    plot.growth = 6;
    plot.cared = false;
    state.seedlings--;
    state.stats.planted++;
    state.focus.field = true;
    toast(`Seedling planted in plot ${index + 1}.`, "success");
    renderAll();
  }

  function harvestPlot(index) {
    const plot = state.plots[index];
    const landIndex = Math.floor(index / 4);
    const bonus = landIndex === 1 ? 1.05 : landIndex === 2 ? 1.1 : landIndex === 3 ? 1.15 : 1;
    const soilBonus = 1 + Math.max(0, state.stewardship.soil - 50) / 500;
    const yieldAmount = Number((1.55 * bonus * soilBonus).toFixed(2));
    state.ffb = Number((state.ffb + yieldAmount).toFixed(2));
    plot.status = "growing";
    plot.growth = 12;
    plot.cared = false;
    state.stats.harvests++;
    state.stewardship.soil = clamp(state.stewardship.soil - 1);
    toast(`Harvested ${yieldAmount.toFixed(2)} t of fresh fruit bunches.`, "success");
    renderAll();
  }

  function buySeedling() {
    if (state.money < seedPrice) { toast("Not enough rupiah for a seedling.", "error"); return; }
    transact("Oil palm seedling", -seedPrice, "Supplies");
    state.seedlings++;
    toast("One certified seedling added to your storehouse.", "success");
    renderAll();
  }

  function plantAll() {
    const open = state.plots.slice(0, capacity()).map((p, i) => ({ p, i })).filter(({ p }) => p.status === "empty");
    const count = Math.min(open.length, state.seedlings);
    if (!count) return;
    for (let i = 0; i < count; i++) {
      open[i].p.status = "growing";
      open[i].p.growth = 6;
      open[i].p.cared = false;
    }
    state.seedlings -= count;
    state.stats.planted += count;
    state.focus.field = true;
    toast(`Planted ${count} open plot${count > 1 ? "s" : ""}.`, "success");
    renderAll();
  }

  function compost() {
    const growing = state.plots.slice(0, capacity()).filter(p => p.status === "growing" && !p.cared);
    if (!growing.length || state.money < compostPrice) return;
    transact("Organic field compost", -compostPrice, "Field care");
    growing.forEach(p => { p.cared = true; p.growth = Math.min(99, p.growth + 7); });
    state.stewardship.soil = clamp(state.stewardship.soil + 4);
    toast(`Compost applied to ${growing.length} growing plot${growing.length > 1 ? "s" : ""}.`, "success");
    renderAll();
  }

  function renderMarket() {
    const previous = state.marketHistory[state.marketHistory.length - 2];
    const pct = ((currentPrice() - previous) / previous) * 100;
    el("marketPriceHeader").textContent = `${formatRp(currentPrice())} / ton`;
    el("marketTrendHeader").textContent = `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}% today`;
    el("marketTrendHeader").style.color = pct >= 0 ? "#5c8c55" : "#b85b49";
    el("ffbStock").textContent = `${state.ffb.toFixed(2)} t`;
    el("cpoStock").textContent = `${state.cpo.toFixed(2)} t`;
    const canProcess = state.ffb >= batchFfb && state.money >= processCost;
    el("processBtn").disabled = !canProcess;
    el("millStatus").textContent = canProcess ? "Batch ready" : state.ffb < batchFfb ? `${Math.max(0, batchFfb - state.ffb).toFixed(2)} t TBS needed` : "Processing funds needed";
    el("millCopy").textContent = `${batchFfb.toFixed(1)} t TBS → ${batchCpo.toFixed(1)} t CPO · ${formatRp(processCost, true)} processing`;
    const range = el("sellRange");
    const currentValue = Math.min(Number(range.value), state.cpo);
    range.max = state.cpo.toFixed(2);
    range.value = currentValue;
    el("sellMaxLabel").textContent = `${state.cpo.toFixed(2)} t available`;
    updateSaleEstimate();
    el("sellBtn").disabled = state.cpo <= 0 || Number(range.value) <= 0;
    el("largeChart").innerHTML = chartSvg(state.marketHistory, 500, 160);
  }

  function updateSaleEstimate() {
    const amount = Number(el("sellRange").value || 0);
    el("sellAmountLabel").textContent = `${amount.toFixed(2)} t`;
    el("saleEstimate").textContent = formatRp(amount * currentPrice());
    el("sellBtn").disabled = amount <= 0;
  }

  function processBatch() {
    if (state.ffb < batchFfb || state.money < processCost) { toast("You need 4.2 t TBS and Rp180k for this batch.", "error"); return; }
    state.ffb = Number((state.ffb - batchFfb).toFixed(2));
    state.cpo = Number((state.cpo + batchCpo).toFixed(2));
    transact("Community mill processing", -processCost, "Processing");
    state.stats.batches++;
    state.focus.mill = true;
    state.stewardship.community = clamp(state.stewardship.community + 2);
    toast("One ton of CPO is now ready in storage.", "success");
    renderAll();
  }

  function sellCpo() {
    const amount = Number(Number(el("sellRange").value).toFixed(2));
    if (amount <= 0 || amount > state.cpo) return;
    const revenue = Math.round(amount * currentPrice());
    state.cpo = Number((state.cpo - amount).toFixed(2));
    state.stats.salesRevenue += revenue;
    transact(`CPO sale · ${amount.toFixed(2)} t`, revenue, "CPO sale");
    el("sellRange").value = 0;
    toast(`Sale complete: ${formatRp(revenue)} received.`, "success");
    renderAll();
  }

  function renderLands() {
    el("capacityLabel").textContent = `${capacity()} plots`;
    el("mapPins").innerHTML = landCatalog.map((land, index) => {
      const owned = state.ownedLands.includes(land.id);
      const locked = state.reputation < land.rep || stewardshipScore() < land.stewardship;
      return `<div class="map-pin ${owned ? "owned" : locked ? "locked" : ""}" style="left:${land.x}%;top:${land.y}%" title="${land.name}"><span>${owned ? "✓" : index + 1}</span></div>`;
    }).join("");
    el("landGrid").innerHTML = landCatalog.map(land => {
      const owned = state.ownedLands.includes(land.id);
      const repLocked = state.reputation < land.rep;
      const stewardLocked = stewardshipScore() < land.stewardship;
      const requirement = repLocked ? `${land.rep} reputation needed` : stewardLocked ? `${land.stewardship} stewardship needed` : state.money < land.price ? "Build your balance" : "Agreement available";
      return `<article class="land-card"><div class="land-card-top"><span class="land-tag">${owned ? "✓ Secured" : land.tag}</span></div><div class="land-body"><p class="eyebrow">${owned ? "Your estate" : requirement}</p><h3>${land.name}</h3><p>${land.description}</p><div class="land-facts"><div><span>Capacity</span><b>+${land.plots} plots</b></div><div><span>Yield</span><b>${land.yield}</b></div></div><div class="land-price"><strong>${owned ? "Owned" : formatRp(land.price, true)}</strong>${owned ? "" : `<button class="button ${repLocked || stewardLocked ? "button--cream" : "button--dark"}" data-land="${land.id}">${repLocked || stewardLocked ? "Locked" : "Review"}</button>`}</div></div></article>`;
    }).join("");
  }

  function reviewLand(id) {
    const land = landCatalog.find(l => l.id === id);
    if (!land || state.ownedLands.includes(id)) return;
    if (state.reputation < land.rep) { toast(`Build ${land.rep} reputation to unlock this agreement.`, "error"); return; }
    if (stewardshipScore() < land.stewardship) { toast(`Raise stewardship to ${land.stewardship} for this partnership.`, "error"); return; }
    openModal(`<p class="eyebrow">${land.tag}</p><h2>${land.name}</h2><p>${land.description}</p><div class="land-facts"><div><span>New capacity</span><b>+${land.plots} plots</b></div><div><span>Harvest yield</span><b>${land.yield}</b></div></div><p>This is a permanent land agreement. It costs <b>${formatRp(land.price)}</b> and supports legal, transparent expansion.</p>${state.money < land.price ? `<p class="warning-text">You need ${formatRp(land.price - state.money)} more.</p>` : ""}<div class="modal-actions"><button class="button button--cream" id="cancelLand">Not yet</button><button class="button button--dark" id="confirmLand" ${state.money < land.price ? "disabled" : ""}>Sign agreement</button></div>`);
    el("cancelLand").onclick = closeModal;
    el("confirmLand").onclick = () => buyLand(land);
  }

  function buyLand(land) {
    if (state.money < land.price) return;
    transact(`Land agreement · ${land.name}`, -land.price, "Expansion");
    state.ownedLands.push(land.id);
    state.reputation += 2;
    state.stewardship.community = clamp(state.stewardship.community + (land.id === "riverside" ? 8 : 2));
    closeModal();
    toast(`${land.name} joined your estate. ${land.plots} plots unlocked!`, "success");
    renderAll();
  }

  function renderJobs() {
    const remaining = jobs.filter(j => !state.jobsToday[j.id]).length;
    el("jobsRemaining").textContent = `${remaining} available`;
    el("jobGrid").innerHTML = jobs.map(job => {
      const done = state.jobsToday[job.id];
      return `<article class="job-card"><div class="job-art">${job.icon}</div><p class="eyebrow">${job.eyebrow}</p><h3>${job.name}</h3><p>${job.description}</p><div class="job-bottom"><div class="job-pay"><span>UP TO</span><b>${formatRp(job.pay, true)} · ${job.time}</b></div>${done ? `<span class="job-done">Done today ✓</span>` : `<button class="button ${job.id === "math" ? "button--sun" : "button--dark"}" data-job="${job.id}">Play →</button>`}</div></article>`;
    }).join("");
  }

  function startJob(id) {
    if (state.jobsToday[id]) return;
    el("jobStage").classList.remove("is-hidden");
    el("jobStage").scrollIntoView({ behavior: "smooth", block: "center" });
    if (id === "harvest") startFruitGame();
    if (id === "math") startMathGame();
    if (id === "delivery") startDeliveryGame();
  }

  function startFruitGame() {
    let time = 15;
    let score = 0;
    el("jobStage").innerHTML = `<p class="eyebrow">Fruit Sorter</p><h3>Tap 8 ripe bunches!</h3><p>Only the bright ripe bunch counts. Be quick.</p><strong class="game-timer" id="gameTimer">${time}</strong><div class="fruit-game" id="fruitGame"></div><b id="fruitScore">0 / 8 sorted</b>`;
    const game = el("fruitGame");
    function spawn() {
      game.innerHTML = "";
      const target = document.createElement("button");
      target.className = "fruit-target";
      target.textContent = "🟠";
      target.setAttribute("aria-label", "Ripe fruit bunch");
      target.style.left = `${10 + Math.random() * 80}%`;
      target.style.top = `${15 + Math.random() * 70}%`;
      target.onclick = () => {
        score++;
        el("fruitScore").textContent = `${score} / 8 sorted`;
        if (score >= 8) finishJob("harvest", 400_000, "Perfect sorting run!");
        else spawn();
      };
      game.appendChild(target);
    }
    spawn();
    clearInterval(jobTimer);
    jobTimer = setInterval(() => {
      time--;
      if (el("gameTimer")) el("gameTimer").textContent = time;
      if (time <= 0) {
        clearInterval(jobTimer);
        const reward = score >= 5 ? 220_000 : 100_000;
        finishJob("harvest", reward, `${score} bunches sorted.`);
      }
    }, 1000);
  }

  function startMathGame() {
    const tons = [2, 3, 4][Math.floor(Math.random() * 3)];
    const price = [10, 11, 12][Math.floor(Math.random() * 3)];
    const answer = tons * price;
    const choices = [answer, answer + tons, answer - price].sort(() => Math.random() - .5);
    el("jobStage").innerHTML = `<p class="eyebrow">Trader’s Desk</p><h3>Which offer is correct?</h3><p>A buyer wants <b>${tons} tons</b> at <b>Rp${price}m per ton</b>. What is the sale value?</p><div class="choice-grid">${choices.map(c => `<button data-math="${c}" data-answer="${answer}"><b>Rp${c}m</b></button>`).join("")}</div>`;
  }

  function startDeliveryGame() {
    const weather = currentWeather();
    const routes = weather.id === "rain"
      ? [{ name: "Paved village road", note: "Longer, safe in rain", good: true }, { name: "River crossing", note: "Fast, but flooding", good: false }, { name: "Plantation track", note: "Muddy shortcut", good: false }]
      : weather.id === "dry"
        ? [{ name: "Shaded river road", note: "Cool and reliable", good: true }, { name: "Open hillside", note: "Fast, very dusty", good: false }, { name: "Market detour", note: "Busy traffic", good: false }]
        : [{ name: "Plantation shortcut", note: "Clear and direct", good: true }, { name: "Market road", note: "Crowded today", good: false }, { name: "River loop", note: "Scenic but slow", good: false }];
    el("jobStage").innerHTML = `<p class="eyebrow">Village Delivery · ${weather.icon} ${weather.name}</p><h3>Choose today’s route</h3><p>Get the certified seedlings to the co-op safely and on time.</p><div class="choice-grid">${routes.map((r, i) => `<button data-route="${i}" data-good="${r.good}"><b>${r.name}</b><br><small>${r.note}</small></button>`).join("")}</div>`;
  }

  function finishJob(id, reward, message) {
    clearInterval(jobTimer);
    if (state.jobsToday[id]) return;
    state.jobsToday[id] = true;
    state.stats.jobs++;
    state.focus.job = true;
    state.reputation += reward >= 300_000 ? 1 : 0;
    state.stewardship.community = clamp(state.stewardship.community + 2);
    transact(`${jobs.find(j => j.id === id).name} side job`, reward, "Side job");
    el("jobStage").innerHTML = `<p class="eyebrow">Job complete</p><h3>${message}</h3><p>The co-op paid <b>${formatRp(reward)}</b>. Community trust increased too.</p><button class="button button--dark" id="closeJob">Back to jobs</button>`;
    el("closeJob").onclick = () => el("jobStage").classList.add("is-hidden");
    toast(`${formatRp(reward)} earned from a side job.`, "success");
    renderTopbar(); renderJobs(); renderQuests(); renderLedger(); saveGame();
    checkQuests();
  }

  function checkQuests() {
    let changed = false;
    questCatalog.forEach(q => {
      if (!state.completedQuests.includes(q.id) && q.metric(state) >= q.goal) {
        state.completedQuests.push(q.id);
        state.reputation += q.rep;
        transact(`Quest reward · ${q.name}`, q.reward, "Quest reward");
        toast(`<b>Quest complete:</b> ${q.name} · ${formatRp(q.reward, true)}`, "success");
        changed = true;
      }
    });
    if (changed) {
      renderTopbar();
      renderQuests();
      renderLedger();
      saveGame();
    }
  }

  function renderQuests() {
    el("questCompleteCount").textContent = state.completedQuests.length;
    const filtered = questCatalog.filter(q => activeQuestFilter === "all" || (activeQuestFilter === "complete" ? state.completedQuests.includes(q.id) : !state.completedQuests.includes(q.id)));
    el("questList").innerHTML = filtered.length ? filtered.map(q => {
      const value = Math.min(q.goal, q.metric(state));
      const pct = Math.min(100, (value / q.goal) * 100);
      const complete = state.completedQuests.includes(q.id);
      const progressText = q.goal >= 1_000_000 ? `${formatRp(value, true)} / ${formatRp(q.goal, true)}` : `${Math.floor(value)} / ${q.goal}`;
      return `<article class="quest-card ${complete ? "complete" : ""}"><div class="quest-icon">${complete ? "✓" : q.icon}</div><div><h3>${q.name}</h3><p>${q.description}</p></div><div class="quest-progress"><span><i>PROGRESS</i><b>${complete ? "Complete" : progressText}</b></span><div class="progress"><i style="width:${pct}%"></i></div></div><div class="quest-reward"><span>REWARD</span><b>${formatRp(q.reward, true)} · +${q.rep} rep</b></div></article>`;
    }).join("") : `<div class="empty-state">No quests in this view.</div>`;
    const milestones = [
      [1, "Smallholder", "Your first four plots"], [2, "Growing Kebun", "Secure a second parcel"], [3, "Established Grower", "Operate twelve plots"], [4, "Valley Estate", "Connect all four parcels"],
    ];
    el("milestoneList").innerHTML = milestones.map(([n, name, copy]) => `<div class="milestone ${state.ownedLands.length >= n ? "reached" : ""}"><span>${state.ownedLands.length >= n ? "✓" : n}</span><div><b>${name}</b><small>${copy}</small></div></div>`).join("");
  }

  function renderLedger() {
    const profit = state.stats.totalIncome - state.stats.totalExpenses;
    el("ledgerStats").innerHTML = `<article class="ledger-stat positive"><span>Total income</span><strong>${formatRp(state.stats.totalIncome, true)}</strong></article><article class="ledger-stat negative"><span>Total expenses</span><strong>−${formatRp(state.stats.totalExpenses, true)}</strong></article><article class="ledger-stat ${profit >= 0 ? "positive" : "negative"}"><span>Lifetime profit</span><strong>${formatRp(profit, true)}</strong></article>`;
    el("ledgerRows").innerHTML = state.ledger.length ? state.ledger.map(row => `<div class="ledger-row"><b>${row.description}</b><span>Day ${row.day}</span><span>${row.type}</span><strong class="${row.amount >= 0 ? "income" : "expense"}">${row.amount >= 0 ? "+" : "−"}${formatRp(Math.abs(row.amount))}</strong></div>`).join("") : `<div class="empty-state">Your transactions will appear here.</div>`;
  }

  function endDay() {
    const growing = state.plots.slice(0, capacity()).filter(p => p.status === "growing");
    const readyBefore = state.plots.slice(0, capacity()).filter(p => p.status === "ready").length;
    const weather = currentWeather();
    growing.forEach(p => {
      const careBonus = p.cared ? 10 : 0;
      p.growth = Math.min(100, p.growth + 29 * weather.growth + careBonus);
      if (p.growth >= 100) p.status = "ready";
      p.cared = false;
    });
    state.day++;
    const oldPrice = currentPrice();
    const marketMove = .955 + Math.random() * .095;
    const nextPrice = clamp(Math.round(oldPrice * marketMove / 10_000) * 10_000, 8_500_000, 15_500_000);
    state.marketHistory.push(nextPrice);
    if (state.marketHistory.length > 7) state.marketHistory.shift();
    const weatherRoll = Math.random();
    state.weather = weatherRoll < .38 ? "sunny" : weatherRoll < .62 ? "cloudy" : weatherRoll < .85 ? "rain" : "dry";
    state.jobsToday = { harvest: false, math: false, delivery: false };
    state.focus = { field: false, job: false, mill: false };
    state.stewardship.water = clamp(state.stewardship.water + (state.weather === "rain" ? 3 : state.weather === "dry" ? -3 : 0));
    const readyNow = state.plots.slice(0, capacity()).filter(p => p.status === "ready").length;
    renderAll();
    const priceWord = nextPrice > oldPrice ? "rose" : nextPrice < oldPrice ? "fell" : "held steady";
    openModal(`<p class="eyebrow">Day ${state.day} begins · ${currentWeather().icon} ${currentWeather().name}</p><h2>A new day<br />in the valley.</h2><p>The CPO market ${priceWord} to <b>${formatRp(nextPrice)} per ton</b>.</p>${readyNow > readyBefore ? `<p><b>${readyNow - readyBefore} new plot${readyNow - readyBefore > 1 ? "s are" : " is"} ready to harvest.</b></p>` : growing.length ? `<p>Your young palms made progress in ${weather.name.toLowerCase()} weather.</p>` : `<p>Your fields are quiet. Plant seedlings when you’re ready to grow.</p>`}<div class="modal-actions"><button class="button button--dark" id="startDayBtn">Start the day →</button></div>`);
    el("startDayBtn").onclick = closeModal;
  }

  function exportLedger() {
    const rows = [["Day", "Description", "Type", "Amount (IDR)"], ...state.ledger.slice().reverse().map(r => [r.day, r.description, r.type, r.amount])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sawit-simulator-ledger-day-${state.day}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Ledger exported as CSV.", "success");
  }

  function openSettings() {
    openModal(`<p class="eyebrow">Game menu</p><h2>Settings &amp; save</h2><p>Your game saves automatically in this browser. Export a backup if you plan to switch devices.</p><div class="settings-list"><button class="button button--cream" id="exportSave">Export save file <span>↓</span></button><button class="button button--cream" id="importSave">Import save file <span>↑</span></button><button class="button button--cream" id="renamePlayer">Change player name <span>✎</span></button><button class="button button--cream" id="aboutGame">About this game <span>→</span></button><button class="button button--cream" id="resetGame">Reset all progress <span>×</span></button></div><input type="file" id="saveFileInput" accept="application/json" class="is-hidden" />`);
    el("exportSave").onclick = exportSave;
    el("importSave").onclick = () => el("saveFileInput").click();
    el("saveFileInput").onchange = importSave;
    el("renamePlayer").onclick = renamePlayer;
    el("aboutGame").onclick = showAbout;
    el("resetGame").onclick = confirmReset;
  }

  function exportSave() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sawit-simulator-day-${state.day}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Save backup exported.", "success");
  }

  function importSave(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (imported.version !== 1 || !Array.isArray(imported.plots)) throw new Error();
        state = imported;
        closeModal();
        renderAll();
        toast("Save imported successfully.", "success");
      } catch { toast("That does not look like a valid Sawit Simulator save.", "error"); }
    };
    reader.readAsText(file);
  }

  function renamePlayer() {
    openModal(`<p class="eyebrow">Player profile</p><h2>What should we<br />call you?</h2><input class="name-input" id="renameInput" maxlength="18" value="${state.playerName}" /><div class="modal-actions"><button class="button button--dark" id="saveName">Save name</button></div>`);
    el("saveName").onclick = () => { state.playerName = el("renameInput").value.trim() || state.playerName; closeModal(); renderAll(); };
  }

  function showAbout() {
    openModal(`<p class="eyebrow">Sawit Simulator · v1.0</p><h2>Grow with<br />purpose.</h2><p>A cozy, fictional management game inspired by Indonesia’s smallholder landscapes. It explores the business loop around fresh fruit bunches and crude palm oil without representing real prices, yields, locations, or legal advice.</p><p>Designed as a free, open web game. The generated landscape artwork is original to this project.</p><div class="modal-actions"><button class="button button--dark" id="aboutClose">Back to game</button></div>`);
    el("aboutClose").onclick = closeModal;
  }

  function confirmReset() {
    openModal(`<p class="eyebrow">Reset game</p><h2>Start from<br />day one?</h2><p class="warning-text">This permanently replaces your local progress. Export a save backup first if you might want it later.</p><div class="modal-actions"><button class="button button--cream" id="keepSave">Keep playing</button><button class="button button--dark" id="doReset">Reset progress</button></div>`);
    el("keepSave").onclick = closeModal;
    el("doReset").onclick = () => { state = newState(); saveGame(); closeModal(); goTo("overview"); showOnboarding(); };
  }

  function bindEvents() {
    el("newGameBtn").addEventListener("click", () => startGame(true));
    el("continueBtn").addEventListener("click", () => startGame(false));
    el("endDayBtn").addEventListener("click", endDay);
    el("buySeedBtn").addEventListener("click", buySeedling);
    el("plantAllBtn").addEventListener("click", plantAll);
    el("compostBtn").addEventListener("click", compost);
    el("processBtn").addEventListener("click", processBatch);
    el("sellRange").addEventListener("input", updateSaleEstimate);
    el("sellBtn").addEventListener("click", sellCpo);
    el("settingsBtn").addEventListener("click", openSettings);
    el("exportLedgerBtn").addEventListener("click", exportLedger);
    el("mobileMenu").addEventListener("click", () => el("sidebar").classList.toggle("is-open"));
    el("modalClose").addEventListener("click", closeModal);
    el("modalLayer").addEventListener("click", event => { if (event.target === el("modalLayer") && !el("modalClose").classList.contains("is-hidden")) closeModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !el("modalClose").classList.contains("is-hidden")) closeModal(); });
    document.addEventListener("click", event => {
      const nav = event.target.closest("[data-tab]");
      const go = event.target.closest("[data-go]");
      const plot = event.target.closest("[data-plot]");
      const land = event.target.closest("[data-land]");
      const job = event.target.closest("[data-job]");
      const math = event.target.closest("[data-math]");
      const route = event.target.closest("[data-route]");
      const filter = event.target.closest("[data-filter]");
      if (nav) goTo(nav.dataset.tab);
      if (go) goTo(go.dataset.go);
      if (plot) handlePlot(Number(plot.dataset.plot));
      if (land) reviewLand(land.dataset.land);
      if (job) startJob(job.dataset.job);
      if (math) finishJob("math", Number(math.dataset.math) === Number(math.dataset.answer) ? 350_000 : 150_000, Number(math.dataset.math) === Number(math.dataset.answer) ? "Sharp calculation!" : "Close—the co-op paid a training fee.");
      if (route) finishJob("delivery", route.dataset.good === "true" ? 300_000 : 160_000, route.dataset.good === "true" ? "On time and safely delivered!" : "Delivered, but the detour cost some time.");
      if (filter) {
        activeQuestFilter = filter.dataset.filter;
        $$(".filter").forEach(f => f.classList.toggle("is-active", f === filter));
        renderQuests();
      }
    });
  }

  function init() {
    bindEvents();
    const saved = loadGame();
    el("continueBtn").classList.toggle("is-hidden", !saved);
    if (saved) el("continueBtn").textContent = `Continue · Day ${saved.day}`;
  }

  init();
})();
