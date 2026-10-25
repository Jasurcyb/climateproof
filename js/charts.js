// ClimateProof charts — dependency-free canvas renderers.
(function () {
  "use strict";
  const G = typeof window !== "undefined" ? window : globalThis;

  function setupCanvas(cv, dpr) {
    dpr = dpr || window.devicePixelRatio || 1;
    const w = cv.clientWidth || cv.parentElement.clientWidth || 600;
    const h = cv.clientHeight || 260;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#333";
  }

  // ---------- Keeling chart: actual, fit, backtest, forecast + uncertainty ----------
  function drawKeeling(cv, opts) {
    const { ctx, w, h } = setupCanvas(cv);
    const P = { l: 46, r: 12, t: 14, b: 26 };
    const all = [].concat(opts.actual, opts.forecast, [[opts.xMax, 0]]);
    const xMin = opts.xMin, xMax = opts.xMax;
    const yMin = Math.min(opts.modelMin, 300), yMax = Math.max(opts.modelMax, 445);
    const X = (t) => P.l + ((t - xMin) / (xMax - xMin)) * (w - P.l - P.r);
    const Y = (v) => h - P.b - ((v - yMin) / (yMax - yMin)) * (h - P.t - P.b);

    ctx.clearRect(0, 0, w, h);
    // grid + axes
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 0.6; ctx.fillStyle = css("--muted");
    ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "center";
    for (let yr = 1960; yr <= 2050; yr += 10) {
      ctx.beginPath(); ctx.moveTo(X(yr), P.t); ctx.lineTo(X(yr), h - P.b); ctx.stroke();
      ctx.fillText(String(yr), X(yr), h - 8);
    }
    ctx.textAlign = "right";
    for (let ppm = 320; ppm <= 440; ppm += 40) {
      ctx.beginPath(); ctx.moveTo(P.l, Y(ppm)); ctx.lineTo(w - P.r, Y(ppm)); ctx.stroke();
      ctx.fillText(String(ppm), P.l - 6, Y(ppm) + 3);
    }
    ctx.textAlign = "left"; ctx.fillText("ppm", P.l - 32, P.t + 2);

    // uncertainty band (±2σ around forecast)
    ctx.beginPath();
    let first = true;
    for (const [t, v] of opts.forecast) { const y = Y(v + 2 * opts.sigma); first ? (ctx.moveTo(X(t), y), first = false) : ctx.lineTo(X(t), y); }
    for (let i = opts.forecast.length - 1; i >= 0; i--) { const [t, v] = opts.forecast[i]; ctx.lineTo(X(t), Y(v - 2 * opts.sigma)); }
    ctx.closePath();
    ctx.fillStyle = "rgba(59,130,99,0.14)";
    ctx.fill();

    // actual series (train = ink, test = accent dots)
    ctx.strokeStyle = css("--ink"); ctx.lineWidth = 1.4; ctx.beginPath();
    let started = false;
    for (const r of opts.actual) { const x = X(r[2]), y = Y(r[3]); started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), started = true); }
    ctx.stroke();
    if (opts.test) {
      ctx.fillStyle = css("--accent");
      for (const r of opts.test) { ctx.beginPath(); ctx.arc(X(r[2]), Y(r[3]), 1.5, 0, 7); ctx.fill(); }
    }

    // forecast line
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 1.8; ctx.setLineDash([5, 3]); ctx.beginPath();
    started = false;
    for (const [t, v] of opts.forecast) { const x = X(t), y = Y(v); started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), started = true); }
    ctx.stroke(); ctx.setLineDash([]);

    // holdout divider
    if (opts.cut) {
      ctx.strokeStyle = css("--warn"); ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(X(opts.cut), P.t); ctx.lineTo(X(opts.cut), h - P.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = css("--warn"); ctx.textAlign = "left"; ctx.font = "9.5px system-ui, sans-serif";
      ctx.fillText("backtest starts →", X(opts.cut) + 4, P.t + 10);
    }
    // legend
    ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "left";
    const lx = P.l + 8, ly = P.t + 8;
    ctx.fillStyle = css("--ink"); ctx.fillRect(lx, ly, 14, 2.4);
    ctx.fillText("measured (NOAA Mauna Loa)", lx + 20, ly + 4);
    ctx.fillStyle = css("--accent"); ctx.fillRect(lx, ly + 14, 14, 2.4);
    ctx.fillText("AI model fit / forecast ±2σ", lx + 20, ly + 18);
  }

  // ---------- Loss curve ----------
  function drawLoss(cv, losses) {
    const { ctx, w, h } = setupCanvas(cv);
    const P = { l: 40, r: 10, t: 10, b: 22 };
    ctx.clearRect(0, 0, w, h);
    const xs = losses.map((l) => l.ep), ys = losses.map((l) => l.loss);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = (x) => P.l + ((x - x0) / (x1 - x0 || 1)) * (w - P.l - P.r);
    const Y = (y) => h - P.b - ((y - y0) / (y1 - y0 || 1)) * (h - P.t - P.b);
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(P.l, h - P.b); ctx.lineTo(w - P.r, h - P.b); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(P.l, P.t); ctx.lineTo(P.l, h - P.b); ctx.stroke();
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 2; ctx.beginPath();
    losses.forEach((l, i) => (i ? ctx.lineTo(X(l.ep), Y(l.loss)) : ctx.moveTo(X(l.ep), Y(l.loss))));
    ctx.stroke();
    ctx.fillStyle = css("--muted"); ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left"; ctx.fillText("epoch " + x1, P.l + 4, P.t + 8);
    ctx.textAlign = "right"; ctx.fillText("MSE", P.l - 4, P.t + 8);
  }

  G.CLIMATEPROOF_CHARTS = { drawKeeling, drawLoss };
})();
