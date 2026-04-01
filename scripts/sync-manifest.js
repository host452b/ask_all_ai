#!/usr/bin/env node
// sync-manifest.js
// Reads SITE_GROUPS from popup.js and updates manifest.json so that
// host_permissions and content_scripts.matches stay in sync automatically.
//
// Usage: node scripts/sync-manifest.js

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const POPUP_JS = path.join(ROOT, "popup", "popup.js");
const MANIFEST = path.join(ROOT, "manifest.json");

// ---- extract hostnames from popup.js SITE_GROUPS ----

const popupSrc = fs.readFileSync(POPUP_JS, "utf-8");

// match all hostname: "..." entries inside SITE_GROUPS
const hostnameRe = /hostname:\s*"([^"]+)"/g;
const hostnames = new Set();
let m;
while ((m = hostnameRe.exec(popupSrc)) !== null) {
  hostnames.add(m[1]);
}

if (hostnames.size === 0) {
  console.error("ERROR: no hostnames found in popup.js SITE_GROUPS");
  process.exit(1);
}

// build sorted URL patterns
const patterns = [...hostnames]
  .sort()
  .map((h) => `https://${h}/*`);

console.log(`Found ${patterns.length} site patterns in popup.js`);

// ---- update manifest.json ----

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf-8"));

manifest.host_permissions = [...patterns];
// keep optional_host_permissions unchanged
if (manifest.content_scripts && manifest.content_scripts.length > 0) {
  manifest.content_scripts[0].matches = [...patterns];
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log("manifest.json updated successfully.");
