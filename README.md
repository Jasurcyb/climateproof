# 🌿 ClimateProof — Climate data you can prove

**Track 4 · Climate Data & Environmental Monitoring** — IEEE ClimateChain Global Hackathon 2026

Climate data underpins every climate decision — carbon markets, loss-and-damage claims, national inventories, COP commitments. Yet the data itself is alarmingly easy to dispute: readings sit in mutable databases, "corrected" after the fact, and there is no way for an outsider to prove what a sensor actually said last year. ClimateProof fixes the **trust layer**: an open, append-only **transparency log** for environmental readings, modelled on Certificate Transparency, with an **AI physics baseline** that flags suspicious measurements — and everything runs locally in a browser tab.

> **The pitch:** A station signs every reading with its own ECDSA key. Readings are hash-chained into SHA-256 blocks with Merkle proofs. An AI model — trained live in your browser on 68 years of NOAA measurements — scores every reading against physics and flags anomalies. You can try to forge a reading yourself in the **Tamper Lab** and watch three independent cryptographic locks stop you.

---

## ✨ The four modules

| Module | What you see |
|---|---|
| 📊 **Dashboard** | The iconic Keeling curve (823 real monthly NOAA measurements, 1958–2026), the AI model's fit and forecast to 2050 with a 95% band, honest backtest divider, live station feed with AI anomaly flags, ledger summary. |
| ⛓ **Ledger** | Hash-linked blocks with Merkle roots, per-entry ECDSA signatures, and a **Verify entire chain** button that recomputes every hash, root and signature in front of you. Stream new readings and watch a block get sealed (light PoW anchor). |
| 🧪 **Tamper Lab** | Pick any sealed reading, forge its CO₂ value, and watch verification fail — with a plain-language explanation of exactly which lock tripped (signature / Merkle root / hash chain), plus the honest alternative: signed correction entries. |
| 🧠 **AI Lab** | The model is not pretrained: it trains on your device in ~30 ms. Full equation with physics interpretation, backtest metrics (MAE/RMSE/R² on 10 unseen years), training loss curve, and how AI + cryptography divide the work: **detection is AI, integrity is cryptography, judgement stays human.** |

## 🔐 The cryptography is real (not simulated)

Everything is executed by the browser's native Web Crypto engine:

- **ECDSA P-256** — each station generates a real keypair; readings are genuinely signed and verified.
- **SHA-256** — blocks hash-link via `prevHash`; headers include the Merkle root and a nonce.
- **Merkle trees** — every entry has an inclusion proof you can verify (the "Merkle proof" button in the Ledger).
- **Light PoW anchor** — a block seals only when its hash starts with `0` (average ~16 attempts; difficulty deliberately tiny so the demo stays instant).
- **Canonical JSON** — sorted-key serialization, so the signed bytes are reproducible across implementations.

*Honest scope note (also stated in the app footer): this is a single-node educational log. Production deployment would follow Certificate Transparency: multiple independent log servers, gossip/witness cosigning, and auditors. The signatures, hashes and proofs themselves are real and verified live.*

## 🧠 The AI is real too

A 7-parameter physics-informed regression trained by gradient descent **in your browser** on every page load:

```
CO₂(t) = a + b·t + c·t²                    ← accelerating human fingerprint
           + A·sin(2πt) + B·cos(2πt)        ← annual biospheric cycle
           + C·sin(4πt) + D·cos(4πt)       ← semi-annual harmonic
```

- **Backtest:** trained on 1958–2016, tested on the 10 most recent years it never saw — **MAE ≈ 0.7 ppm, RMSE ≈ 0.8 ppm, R² ≈ 0.9993** (numbers recomputed live on the page).
- **Anomaly detection:** every station reading is z-scored against the model's prediction; |z| > 3σ is flagged. Flagged readings are **never deleted** — the log is append-only; the AI flags, humans decide.
- **Deterministic:** every visitor sees the same model — reproducibility is one click away.

## 🌍 Why it matters (COP 31 / MRV)

Measurement, Reporting and Verification (MRV) is where climate policy lives or dies: carbon credit integrity, Paris Agreement transparency framework, loss-and-damage evidence, ESG disclosure rules. All of them assume the underlying data cannot be quietly rewritten. ClimateProof is a minimum-viable answer to that assumption, built from standard, inspectable web primitives.

## 🚀 Run it

Zero dependencies, zero build step, no backend, no API keys, offline after load:

```bash
node tools/server.js 8080     # → http://localhost:8080
# or simply double-click index.html (crypto.subtle works on file:// in Chrome/Edge
# when served or on localhost; use the server if your browser blocks it)
```

## 📁 Structure

```
index.html          app shell (4 pages)
css/styles.css      eco design system
js/data.js          generated: NOAA Mauna Loa monthly CO₂ (tools/build-data.js)
js/ml.js            Keeling regression: features, GD training, backtest, anomaly scoring
js/chain.js         transparency log: ECDSA stations, canonical JSON, Merkle, blocks, verification
js/charts.js        dependency-free canvas renderers (Keeling chart, loss curve)
js/app.js           router, dashboard, ledger, tamper lab, AI lab, live station feed
tools/              dataset builder, static server
screenshots/        submission screenshots
```

## 📊 Data & credits

- NOAA Global Monitoring Laboratory, Mauna Loa Observatory monthly mean CO₂ (the Keeling curve) — public domain. <https://gml.noaa.gov/ccgg/trends/>
- Architecture pattern inspired by RFC 6962 (Certificate Transparency).

## ⚠️ Disclaimer

Educational prototype for the IEEE ClimateChain Hackathon. It demonstrates the verification layer, not a production climate registry; the anomaly "stations" simulate sensors for demo purposes.

---

*Team: Jasur Maxkamov · Built for the IEEE ClimateChain Global Hackathon 2026 · Track 4*
