// ClimateProof app shell: state, router, pages, live station network.
(function () {
  "use strict";
  const S = (window.CLIMATEPROOF_APP = {});
  const ML = window.CLIMATEPROOF_ML;
  const CH = window.CLIMATEPROOF_CHAIN;
  const CHARTS = window.CLIMATEPROOF_CHARTS;
  const CO2 = window.CLIMATEPROOF_CO2;
  const META = window.CLIMATEPROOF_META;
  S.pages = {};

  // ---------- State ----------
  let model = null;
  let stations = [];           // {name, id, kp, pub, pubJwk}
  let chain = [];              // sealed blocks
  let mempool = [];            // signed entries waiting for next block
  let feed = [];               // UI feed of latest readings (with AI verdicts)
  let pubKeys = {};            // stationId -> pubJwk
  let tampered = null;         // Tamper Lab working copy

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const fmt = (v, d) => Number(v).toFixed(d === undefined ? 2 : d);
  const nowYearFrac = () => { const d = new Date(); return d.getFullYear() + (d.getMonth() + 0.5) / 12; };

  S.getModel = () => model;
  S.getChain = () => chain;
  S.getStations = () => stations;
  S.getFeed = () => feed;

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", async () => {
    model = ML.buildModel(CO2, 10);
    stations = await Promise.all([
      CH.createStation("Mauna Loa Ref-A"),
      CH.createStation("Urban Net Seoul"),
      CH.createStation("Amazon Flux Tower"),
    ]);
    stations.forEach((st) => (pubKeys[st.id] = st.pubJwk));

    // Seed the log: sign + seal a first batch of real-ish readings so the
    // ledger view is alive from the first paint.
    for (let k = 0; k < 6; k++) await streamReading(false);
    await sealPending();

    document.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) S.go(go.dataset.go);
    });
    S.go("dashboard");
  });

  // ---------- Station network: generate, sign, AI-score ----------
  async function makeReading(st) {
    const t = nowYearFrac() - Math.random() * 2 / 12; // within last 2 months
    const expected = model.predict(t) + (Math.random() - 0.5) * 1.2;
    let ppm = expected;
    const anomaly = Math.random() < 0.12;
    if (anomaly) ppm += (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 14);
    const reading = { station: st.id, stationName: st.name, t: +t.toFixed(4), co2: +ppm.toFixed(2), ts: Date.now() - Math.floor(Math.random() * 6e5), nonce: Math.floor(Math.random() * 1e9) };
    const sig = await CH.signReading(st, reading);
    return { reading, sig, pubJwk: st.pubJwk, anomaly };
  }

  async function streamReading(autoSeal) {
    const st = stations[Math.floor(Math.random() * stations.length)];
    const entry = await makeReading(st);
    const v = ML.anomalyScore(model, entry.reading.t, entry.reading.co2);
    const record = { ...entry, verdict: v };
    feed.unshift(record); feed = feed.slice(0, 14);
    mempool.push(entry);
    if (autoSeal && mempool.length >= 4) await sealPending();
    return record;
  }

  async function sealPending() {
    if (!mempool.length) return;
    const entries = mempool.splice(0, mempool.length);
    const block = await CH.sealBlock(chain, entries);
    chain.push(block);
  }

  S.streamReading = streamReading;
  S.sealPending = sealPending;
  S.makeReading = makeReading;

  // ---------- Router ----------
  S.go = function (page) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    const target = document.getElementById("page-" + page);
    if (!target) return;
    target.classList.add("active");
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
    window.scrollTo({ top: 0 });
    if (S.pages[page]) S.pages[page](target);
  };

  // ---------- Dashboard ----------
  S.pages.dashboard = function (root) {
    const last = CO2[CO2.length - 1];
    const gr = ML.growthRates(model.model, nowYearFrac(), 1970);
    const proj2050 = model.forecast.filter(([t]) => t >= 2049.9 && t <= 2050.1)[0];
    root.innerHTML = `
      <section class="hero">
        <div class="hero-badge">🌿 Track 4 · Climate Data &amp; Environmental Monitoring</div>
        <h1>Climate data you can <span class="grad">prove</span>.</h1>
        <p class="hero-sub">An open, tamper-evident transparency log for environmental readings — every measurement signed at the source, hash-chained into blocks, and watched by an AI trained live in your browser on 68 years of NOAA measurements. No cloud. No trust required.</p>
      </section>
      <section class="statrow">
        <div class="statcard"><div class="stat-num">${fmt(last[3], 1)}</div><div class="stat-label">ppm CO₂ · latest NOAA month (${last[0]}-${String(last[1]).padStart(2, "0")})</div></div>
        <div class="statcard"><div class="stat-num">+${fmt(gr.now, 2)}/yr</div><div class="stat-label">AI-estimated growth today (vs +${fmt(gr.then, 2)} in 1970)</div></div>
        <div class="statcard"><div class="stat-num">~${fmt(proj2050 ? proj2050[1] : 0, 0)}</div><div class="stat-label">ppm projected for 2050 · ±${fmt(2 * model.sigma, 1)} at 95%</div></div>
        <div class="statcard"><div class="stat-num">${fmt(model.mTest.mae, 2)}</div><div class="stat-label">ppm backtest MAE on 10 unseen years</div></div>
      </section>
      <section class="chartcard">
        <h3>The Keeling curve — measured, modelled, forecast</h3>
        <canvas id="keelingChart" class="bigchart"></canvas>
        <p class="muted small">Dots to the right of the amber line were <b>never shown to the model</b> — that is the honest backtest. The model itself is trained in your browser in under a second, every visit.</p>
      </section>
      <section class="livegrid">
        <div class="livefeed">
          <div class="livehead">
            <h3>📡 Live station feed</h3>
            <button class="btn primary" id="newReading">+ New reading</button>
          </div>
          <p class="muted small">Stations sign readings with ECDSA P-256 keys. The AI scores each one against the physics model — anomalies are <b>flagged, never deleted</b>: the log is append-only, humans decide.</p>
          <div id="feedList"></div>
        </div>
        <div class="ledgermini">
          <h3>⛓ Ledger</h3>
          <div class="minirow"><span>blocks</span><b>${chain.length}</b></div>
          <div class="minirow"><span>sealed readings</span><b>${chain.reduce((a, b) => a + b.entries.length, 0)}</b></div>
          <div class="minirow"><span>pending</span><b>${mempool.length}</b></div>
          <div class="minirow"><span>tip hash</span><b class="hash">${esc(chain.length ? chain[chain.length - 1].hash.slice(0, 18) + "…" : "—")}</b></div>
          <button class="btn ghost" data-go="ledger">Open full ledger →</button>
        </div>
      </section>
    `;
    CHARTS.drawKeeling(root.querySelector("#keelingChart"), {
      actual: CO2, test: model.test, forecast: model.forecast, cut: model.cut,
      sigma: model.sigma, xMin: 1958, xMax: 2052, modelMin: 313, modelMax: Math.max(...model.forecast.map((f) => f[1])) + 4,
    });
    renderFeed(root.querySelector("#feedList"));
    root.querySelector("#newReading").addEventListener("click", async () => {
      const btn = root.querySelector("#newReading"); btn.disabled = true; btn.textContent = "signing…";
      const r = await streamReading(true);
      btn.disabled = false; btn.textContent = "+ New reading";
      renderFeed(root.querySelector("#feedList"));
      const ledger = root.querySelector(".ledgermini");
      if (ledger) {
        ledger.querySelector(".minirow:nth-child(2) b").textContent = chain.reduce((a, b) => a + b.entries.length, 0);
        ledger.querySelector(".minirow:nth-child(3) b").textContent = mempool.length;
        ledger.querySelector(".minirow:nth-child(4) b").textContent = chain[chain.length - 1].hash.slice(0, 18) + "…";
      }
      if (r.verdict.flagged) window.CLIMATEPROOF_APP.flash && 0; // no-op keep simple
    });
  };

  function renderFeed(container) {
    container.innerHTML = feed.map((f) => `
      <div class="feedrow ${f.verdict.flagged ? "flagged" : ""}">
        <div class="feed-icon">${f.verdict.flagged ? "⚠️" : "✓"}</div>
        <div class="feed-body">
          <div class="feed-title">${esc(f.reading.stationName)} <span class="feed-id">#${esc(f.reading.station.slice(0, 8))}</span></div>
          <div class="feed-sub">${fmt(f.reading.co2, 2)} ppm · expected ${fmt(f.verdict.expected, 2)} · z = ${fmt(f.verdict.z, 1)}σ ${f.verdict.flagged ? "· AI: ANOMALY — logged &amp; flagged" : "· AI: nominal"}</div>
        </div>
        <div class="feed-sig" title="ECDSA P-256 signature">${esc(f.sig.slice(0, 10))}…</div>
      </div>
    `).join("");
  }

  // ---------- Ledger ----------
  S.pages.ledger = async function (root) {
    root.innerHTML = `
      <header class="pagehead">
        <h1>⛓ Transparency ledger</h1>
        <p>Blocks are hash-linked (SHA-256), every entry sits in a Merkle tree, and every reading carries a real ECDSA signature from its station. Verify the entire chain yourself — right here, on this page.</p>
      </header>
      <div class="trainrow">
        <button class="btn primary big" id="verifyAll">🔍 Verify entire chain</button>
        <button class="btn ghost big" id="addAndSeal">+ Stream readings &amp; seal a block</button>
      </div>
      <div id="verifyOut"></div>
      <div id="chainView"></div>
      <div id="proofOut"></div>
    `;
    renderChain(root.querySelector("#chainView"));

    root.querySelector("#verifyAll").addEventListener("click", async (e) => {
      const btn = e.target; btn.disabled = true; btn.textContent = "verifying signatures…";
      const rep = await CH.verifyChain(chain, pubKeys);
      btn.disabled = false; btn.textContent = "🔍 Verify entire chain";
      const out = root.querySelector("#verifyOut");
      const ok = !rep.firstBad && !rep.badSigs.length;
      out.innerHTML = `
        <div class="feedback show ${ok ? "good" : "bad"}">
          <div class="fb-title">${ok ? "✅ Chain fully verified" : "🚨 Verification FAILED"}</div>
          <p>${ok ? `All ${rep.blocks} blocks hash-linked correctly · ${rep.okSigs}/${rep.entries} ECDSA signatures valid · every Merkle root recomputes.` :
            `Reason: <b>${esc(rep.reason)}</b>${rep.linkBreak !== null ? ` at block ${rep.linkBreak}` : ""}${rep.badSigs.length ? ` · ${rep.badSigs.length} invalid signature(s)` : ""}`}</p>
        </div>`;
      renderChain(root.querySelector("#chainView"));
    });

    root.querySelector("#addAndSeal").addEventListener("click", async (e) => {
      const btn = e.target; btn.disabled = true; btn.textContent = "signing & sealing…";
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) await streamReading(false);
      await sealPending();
      btn.disabled = false; btn.textContent = "+ Stream readings & seal a block";
      renderChain(root.querySelector("#chainView"));
    });
  };

  function renderChain(container) {
    container.innerHTML = chain.length ? chain.slice().reverse().map((b) => `
      <div class="blockcard">
        <div class="block-head">
          <span class="block-h">Block #${b.header.height}</span>
          <span class="block-meta">${b.entries.length} reading${b.entries.length > 1 ? "s" : ""} · sealed in ${b.sealAttempts} hash attempt${b.sealAttempts > 1 ? "s" : ""}</span>
        </div>
        <div class="block-hash">hash <b>${esc(b.hash.slice(0, 40))}…</b> ← prev <b>${esc(b.header.prevHash.slice(0, 24))}…</b></div>
        <div class="block-hash">merkle root <b>${esc(b.header.merkleRoot.slice(0, 40))}…</b></div>
        <div class="block-entries">
          ${b.entries.map((e, i) => `
            <div class="entryrow">
              <span class="entry-idx">#${i}</span>
              <span class="entry-name">${esc(e.reading.stationName)}</span>
              <span class="entry-val">${fmt(e.reading.co2, 2)} ppm</span>
              <span class="entry-sig" title="ECDSA signature">${esc(e.sig.slice(0, 14))}…</span>
              <button class="btn tiny ghost proofbtn" data-block="${b.header.height}" data-idx="${i}">Merkle proof</button>
            </div>`).join("")}
        </div>
      </div>
    `).join("") : `<div class="loadingbox">No blocks yet — stream some readings.</div>`;

    container.querySelectorAll(".proofbtn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const b = chain[+btn.dataset.block], i = +btn.dataset.idx;
        const e = b.entries[i];
        const leaf = await CH.sha256(CH.canonical(e.reading) + e.sig);
        const okProof = await CH.verifyProof(leaf, b.proofs[i], b.header.merkleRoot);
        const okSig = await CH.verifyReading(e.pubJwk, e.reading, e.sig);
        const out = document.getElementById("proofOut");
        if (out) out.innerHTML = `
          <div class="feedback show ${okProof && okSig ? "good" : "bad"}">
            <div class="fb-title">Inclusion proof — reading #${i} of block ${b.header.height}</div>
            <p class="mono small">leaf ${esc(leaf.slice(0, 32))}… · path ${b.proofs[i].length} sibling(s)</p>
            <p>Merkle proof: <b>${okProof ? "VALID ✓ — leaf is in the block's Merkle tree" : "INVALID ✗"}</b><br>
            ECDSA signature: <b>${okSig ? "VALID ✓ — signed by this station's key" : "INVALID ✗"}</b></p>
          </div>`;
        out.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }));
  }

  // ---------- Tamper Lab ----------
  S.pages.tamper = async function (root) {
    if (!tampered) {
      tampered = JSON.parse(JSON.stringify(chain));
    }
    const draw = async (msg) => {
      const rep = await CH.verifyChain(tampered, pubKeys);
      const blockSel = root.querySelector("#tamperBlock");
      blockSel.innerHTML = tampered.map((b) => `<option value="${b.header.height}">#${b.header.height} — ${b.entries.length} readings</option>`).join("");
      const idxSel = root.querySelector("#tamperIdx");
      const b0 = tampered[+blockSel.value || 0];
      idxSel.innerHTML = b0 ? b0.entries.map((e, i) => `<option value="${i}">#${i} · ${esc(e.reading.stationName)} · ${e.reading.co2} ppm</option>`).join("") : "";
      const ok = !rep.firstBad && !rep.badSigs.length;
      root.querySelector("#tamperOut").innerHTML = `
        <div class="feedback show ${ok ? "good" : "bad"}">
          <div class="fb-title">${ok ? "✅ History intact — the log matches its own proofs" : "🚨 TAMPER DETECTED — the forgery cannot reproduce the proofs"}</div>
          <p>${ok ? "Every block hash, Merkle root and signature recomputes cleanly. This is what a verifier (journalist, auditor, regulator) sees." :
            `Failed at: <b>${esc(rep.reason)}</b>${rep.firstBad ? ` (block #${rep.firstBad.header.height})` : ""}${rep.badSigs.length ? ` · ${rep.badSigs.length} signature(s) invalid` : ""}.<br><br>Why it is stuck: the attacker can forge a value, but cannot forge the station's <b>private key</b> (signatures), cannot rebuild the <b>Merkle root</b> without changing the block hash, and cannot change a block hash without re-sealing <b>every later block</b>. ${msg || ""}`}</p>
        </div>`;
    };

    root.innerHTML = `
      <header class="pagehead">
        <h1>🧪 Tamper lab</h1>
        <p>Try to rewrite climate history. Edit a sealed reading and watch the cryptography push back — this is the core of why MRV data needs to be append-only.</p>
      </header>
      <section class="scanbox">
        <div class="tamperrow">
          <select id="tamperBlock" class="sel"></select>
          <select id="tamperIdx" class="sel"></select>
          <input id="tamperVal" class="inp" type="number" step="0.5" placeholder="fake CO₂ ppm (e.g. 350)">
          <button class="btn danger big" id="doTamper">Forge reading</button>
          <button class="btn ghost big" id="doReset">Restore honest log</button>
        </div>
      </section>
      <div id="tamperOut"></div>
      <section class="explainbox">
        <h3>Three locks that protect the record</h3>
        <div class="flagcards">
          <div class="flagcard"><div class="flag-icon">🔑</div><div><h4>1 · Source signature</h4><p>Only the station's private ECDSA key can produce a valid signature. A forged value fails verification instantly.</p></div></div>
          <div class="flagcard"><div class="flag-icon">🌳</div><div><h4>2 · Merkle root</h4><p>The reading's hash lives inside the block's Merkle tree. Change the reading and the root no longer recomputes.</p></div></div>
          <div class="flagcard"><div class="flag-icon">⛓</div><div><h4>3 · Hash chain</h4><p>Each block commits to its predecessor. Rewriting one block invalidates every block after it — the whole history screams.</p></div></div>
        </div>
      </section>
    `;

    root.querySelector("#tamperBlock").addEventListener("change", () => draw());
    root.querySelector("#doTamper").addEventListener("click", async () => {
      const b = tampered[+root.querySelector("#tamperBlock").value];
      const i = +root.querySelector("#tamperIdx").value;
      const v = parseFloat(root.querySelector("#tamperVal").value);
      if (!b || !b.entries[i] || !Number.isFinite(v)) { alert("Pick a reading and enter a fake ppm value."); return; }
      b.entries[i].reading.co2 = +v.toFixed(2);
      await draw("An honest fix exists: append a <b>signed correction entry</b> that references the old one — history is corrected, never erased.");
    });
    root.querySelector("#doReset").addEventListener("click", async () => {
      tampered = JSON.parse(JSON.stringify(chain));
      await draw();
    });
    await draw();
  };

  // ---------- AI Lab ----------
  S.pages.lab = function (root) {
    const m = model;
    const eq = m.model.w;
    root.innerHTML = `
      <header class="pagehead">
        <h1>🧠 AI lab</h1>
        <p>The forecasting model is not a pretrained black box — it is trained <b>right now, on your device</b>, on ${META.n} real monthly NOAA measurements (${META.source}).</p>
      </header>
      <section class="datasetcard">
        <h3>Model — 7-parameter physics-informed regression</h3>
        <p class="mono small">CO₂(t) = ${fmt(eq[0], 1)} + ${fmt(eq[1], 2)}·t + ${fmt(eq[2], 3)}·t² + ${fmt(eq[3], 2)}·sin(2πt) + ${fmt(eq[4], 2)}·cos(2πt) + ${fmt(eq[5], 2)}·sin(4πt) + ${fmt(eq[6], 2)}·cos(4πt)</p>
        <p class="muted small">t = years since 1958. The quadratic term is the accelerating human fingerprint; the sin/cos pair is the annual biospheric breathing cycle (planetary inhale/exhale).</p>
      </section>
      <div class="metricgrid">
        <div class="metriccard"><div class="metric-num">${fmt(m.mTest.mae, 2)}</div><div class="metric-label">backtest MAE (ppm)</div></div>
        <div class="metriccard"><div class="metric-num">${fmt(m.mTest.rmse, 2)}</div><div class="metric-label">backtest RMSE (ppm)</div></div>
        <div class="metriccard"><div class="metric-num">${fmt(m.mTest.r2, 4)}</div><div class="metric-label">R² on 10 unseen years</div></div>
        <div class="metriccard"><div class="metric-num">${fmt(m.model.trainMs, 0)} ms</div><div class="metric-label">trained in your browser</div></div>
        <div class="metriccard"><div class="metric-num">${fmt(m.mTrain.mae, 2)}</div><div class="metric-label">train MAE — gap vs test shows no memorization</div></div>
      </div>
      <section class="labcard">
        <h3>Training loss (mean squared error)</h3>
        <canvas id="lossChart" class="losschart"></canvas>
        <p class="muted small">${m.model.epochs} epochs of L2-regularized gradient descent, ${m.model.trainMs.toFixed(0)} ms total. Deterministic — every visitor sees the same numbers.</p>
      </section>
      <section class="labcard">
        <h3>How the AI and the chain work together</h3>
        <p>The model is the <b>physics baseline</b>: given any timestamp it predicts what trustworthy CO₂ should be. When a station reading deviates by more than 3σ, the AI flags it — and the transparency log preserves the flagged record, unmodified, as evidence. Detection is AI; <b>integrity is cryptography; judgement stays human</b>.</p>
      </section>
    `;
    CHARTS.drawLoss(root.querySelector("#lossChart"), m.model.losses);
  };
})();
