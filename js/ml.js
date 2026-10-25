// ClimateProof ML — Keeling-curve regression: trend + annual harmonics.
// Trained live in the browser via gradient descent; honest backtest metrics.
(function () {
  "use strict";
  const G = typeof window !== "undefined" ? window : globalThis;

  // ---------- Features ----------
  // t = years since 1958.0, normalized for conditioning. The physical model:
  // CO2(t) = a + b·t + c·t²  (accelerating trend)
  //         + A·sin(2πt) + B·cos(2πt)        (annual biospheric cycle)
  //         + C·sin(4πt) + D·cos(4πt)       (semi-annual harmonic)
  const T0 = 1958.0;
  const T_MAX = 2060.0; // normalize across full plot horizon
  function feat(yearFrac, norm) {
    const t = yearFrac - T0;
    const tn = norm !== undefined ? norm : (2 * (yearFrac - T0) / (T_MAX - T0) - 1);
    const w = 2 * Math.PI * t;
    return [1, tn, tn * tn, Math.sin(w), Math.cos(w), Math.sin(2 * w), Math.cos(2 * w)];
  }
  const FEAT_NAMES = ["offset", "trend (linear)", "trend (quadratic)", "annual sin", "annual cos", "semi-annual sin", "semi-annual cos"];

  // ---------- Linear regression via gradient descent ----------
  function train(X, y, opts) {
    opts = opts || {};
    const epochs = opts.epochs || 4000;
    const lr0 = opts.lr0 || 0.35;
    const l2 = opts.l2 || 1e-6;
    const d = X[0].length, n = X.length;
    const w = new Float64Array(d);
    const losses = [];
    const t0 = (G.performance || Date).now ? performance.now() : Date.now();
    for (let ep = 0; ep < epochs; ep++) {
      const lr = lr0 / (1 + ep / 800);
      const gw = new Float64Array(d);
      let loss = 0;
      for (let i = 0; i < n; i++) {
        let p = 0;
        for (let j = 0; j < d; j++) p += w[j] * X[i][j];
        const e = p - y[i];
        loss += e * e;
        for (let j = 0; j < d; j++) gw[j] += e * X[i][j];
      }
      for (let j = 0; j < d; j++) w[j] -= lr * (2 * gw[j] / n + l2 * w[j]);
      if (ep % 200 === 0 || ep === epochs - 1) losses.push({ ep, loss: loss / n });
    }
    return { w, losses, epochs, trainMs: ((G.performance || Date).now ? performance.now() : Date.now()) - t0 };
  }

  function predict(model, yearFrac) {
    const f = feat(yearFrac);
    let p = 0;
    for (let j = 0; j < f.length; j++) p += model.w[j] * f[j];
    return p;
  }

  // ---------- Metrics ----------
  function metrics(model, rows) {
    let mae = 0, rmse = 0, my = 0;
    const preds = [];
    for (const r of rows) my += r[3];
    my /= rows.length;
    for (const r of rows) {
      const p = predict(model, r[2]);
      preds.push(p);
      mae += Math.abs(p - r[3]);
      rmse += (p - r[3]) * (p - r[3]);
    }
    mae /= rows.length; rmse = Math.sqrt(rmse / rows.length);
    let sst = 0;
    for (const r of rows) sst += (r[3] - my) * (r[3] - my);
    const r2 = sst === 0 ? 1 : 1 - (rmse * rmse) * rows.length / sst;
    return { mae, rmse, r2, preds, sigma: rmse };
  }

  // ---------- Full pipeline: split -> train -> backtest -> forecast ----------
  function buildModel(rows, holdoutYears) {
    holdoutYears = holdoutYears || 10;
    const lastYear = rows[rows.length - 1][2];
    const cut = lastYear - holdoutYears;
    const tr = rows.filter((r) => r[2] < cut);
    const te = rows.filter((r) => r[2] >= cut);
    const X = tr.map((r) => feat(r[2]));
    const y = tr.map((r) => r[3]);
    const model = train(X, y);
    const mTrain = metrics(model, tr);
    const mTest = metrics(model, te);
    const forecast = [];
    for (let t = lastYear; t <= 2050.5; t += 1 / 12) forecast.push([t, predict(model, t)]);
    return {
      model, train: tr, test: te, mTrain, mTest, forecast, cut,
      predict: (yf) => predict(model, yf),
      sigma: mTest.rmse,
      holdoutYears,
    };
  }

  // ---------- Anomaly scoring for station readings ----------
  // A reading is scored against what the Keeling model expects at that moment.
  // |z| > 3 => flagged. The log still accepts it (append-only): AI flags, humans decide.
  function anomalyScore(model, yearFrac, ppm) {
    const expected = predict(model.model, yearFrac);
    const z = (ppm - expected) / (model.sigma || 1);
    return { expected, z, flagged: Math.abs(z) > 3 };
  }

  // Growth rate now vs then (ppm/year), from the quadratic derivative.
  function growthRates(model, atYear, baseYear) {
    const g = (y) => {
      const f = feat(y);
      return model.w[1] + 2 * model.w[2] * f[1]; // d/dt of a+b·t+c·t²
    };
    return { now: g(atYear), then: g(baseYear) };
  }

  G.CLIMATEPROOF_ML = { feat, FEAT_NAMES, train, predict, metrics, buildModel, anomalyScore, growthRates };
})();
