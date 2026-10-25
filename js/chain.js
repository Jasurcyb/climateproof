// ClimateProof transparency log — a Certificate-Transparency-style append-only
// ledger for environmental readings, built on real Web Crypto:
//   * ECDSA P-256 station keypairs — readings are genuinely signed & verified
//   * SHA-256 hash-linked blocks with Merkle trees and inclusion proofs
//   * Light difficulty anchor (hash must start with "0") — demo of PoW sealing
// Everything runs locally; no network, no tokens, no backend.
(function () {
  "use strict";
  const G = typeof window !== "undefined" ? window : globalThis;

  const enc = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  async function sha256(str) {
    return hex(await crypto.subtle.digest("SHA-256", enc.encode(str)));
  }

  // Canonical JSON: sorted keys, no whitespace — bytes must be reproducible.
  function canonical(obj) {
    if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
    if (Array.isArray(obj)) return "[" + obj.map(canonical).join(",") + "]";
    return "{" + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
  }

  // ---------- Stations ----------
  async function createStation(name) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const pubJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
    const pub = await crypto.subtle.importKey("jwk", pubJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    return { name, id: (pubJwk.x.slice(0, 6) + pubJwk.y.slice(0, 6)), kp, pub, pubJwk };
  }

  async function signReading(station, reading) {
    const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, station.kp.privateKey, enc.encode(canonical(reading)));
    return hex(sig);
  }

  async function verifyReading(pubJwk, reading, sigHex) {
    try {
      const pub = await crypto.subtle.importKey("jwk", pubJwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
      const sig = new Uint8Array((sigHex || "").match(/.{2}/g).map((h) => parseInt(h, 16)));
      return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, sig, enc.encode(canonical(reading)));
    } catch (e) { return false; }
  }

  // ---------- Merkle tree ----------
  // Returns { root, proofs } where proofs[i] is the sibling path for leaf i.
  // An odd trailing node is duplicated (sibling = itself), the standard CT rule.
  async function buildTree(leafHashes) {
    let level = leafHashes.slice();
    const proofs = leafHashes.map(() => []);
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) {
        const hasR = i + 1 < level.length;
        const a = level[i], b = hasR ? level[i + 1] : level[i];
        const parent = await sha256(hasR ? a + b : a + a);
        next.push(parent);
        if (hasR) {
          if (proofs[i]) proofs[i].push({ sib: b, dir: "R" });
          if (proofs[i + 1]) proofs[i + 1].push({ sib: a, dir: "L" });
        } else if (proofs[i]) {
          proofs[i].push({ sib: a, dir: "R" });
        }
      }
      level = next;
    }
    return { root: level[0] || await sha256(""), proofs };
  }

  async function verifyProof(leafHash, proof, root) {
    let h = leafHash;
    for (const step of proof) h = await sha256(step.dir === "R" ? h + step.sib : step.sib + h);
    return h === root;
  }

  // ---------- Blocks ----------
  // blockHash = SHA-256(canonical header incl. merkleRoot + prevHash), sealed
  // when it starts with "0" (light difficulty anchor for the demo).
  async function sealBlock(chain, entries) {
    const leafHashes = [];
    for (const e of entries) leafHashes.push(await sha256(canonical(e.reading) + e.sig));
    const tree = await buildTree(leafHashes);
    const height = chain.length;
    const prevHash = height ? chain[height - 1].hash : "0".repeat(64);
    let nonce = 0, hash = "", header = null, attempts = 0;
    do {
      header = { height, ts: Date.now(), prevHash, merkleRoot: tree.root, nonce };
      hash = await sha256(canonical(header));
      nonce++; attempts++;
      if (attempts > 5000) break; // safety valve
    } while (hash[0] !== "0");
    return { header, hash, entries, proofs: tree.proofs, sealAttempts: attempts };
  }

  // ---------- Verification of a whole chain ----------
  async function verifyChain(chain, pubKeys) {
    const report = { blocks: chain.length, entries: 0, okBlocks: 0, okSigs: 0, badSigs: [], linkBreak: null, firstBad: null, reason: null };
    let prev = "0".repeat(64);
    for (const b of chain) {
      const recomputed = await sha256(canonical(b.header));
      if (recomputed !== b.hash) { report.firstBad = b; report.reason = "block hash mismatch"; return report; }
      if (b.header.prevHash !== prev) { report.linkBreak = b.header.height; report.reason = "prev-hash link broken"; return report; }
      const leaves = [];
      for (const e of b.entries) leaves.push(await sha256(canonical(e.reading) + e.sig));
      const tree = await buildTree(leaves);
      if (tree.root !== b.header.merkleRoot) { report.firstBad = b; report.reason = "merkle root mismatch"; return report; }
      for (let i = 0; i < b.entries.length; i++) {
        const e = b.entries[i];
        report.entries++;
        const key = pubKeys[e.reading.station] || e.pubJwk;
        const ok = await verifyReading(key, e.reading, e.sig);
        if (ok) report.okSigs++; else report.badSigs.push({ block: b.header.height, idx: i, reading: e.reading });
      }
      report.okBlocks++;
      prev = b.hash;
    }
    return report;
  }

  G.CLIMATEPROOF_CHAIN = {
    sha256, canonical, createStation, signReading, verifyReading,
    buildTree, verifyProof, sealBlock, verifyChain,
  };
})();
