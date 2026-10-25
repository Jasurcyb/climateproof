// Tiny static server for local testing. Usage: node tools/server.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const port = Number(process.argv[2]) || 8080;
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.resolve(root, "." + path.posix.normalize("/" + p.replace(/\\/g, "/"))); // collapses ../ before it can escape
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, () => console.log("serving on http://localhost:" + port));
