const fs = require('fs');
const path = require('path');

// Keep Playwright isolated from any developer server running on the default port.
process.env.PORT = process.env.PLAYWRIGHT_WEB_PORT || '3100';
process.env.HOSTNAME = process.env.HOSTNAME || '127.0.0.1';

const webRoot = path.resolve(__dirname, '../apps/web');
const standaloneRoot = path.join(webRoot, '.next/standalone/apps/web');
const standaloneNextDir = path.join(standaloneRoot, '.next');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

// Standalone output does not include static/public; Next needs them at runtime.
const staticSrc = path.join(webRoot, '.next/static');
const staticDest = path.join(standaloneNextDir, 'static');
if (fs.existsSync(staticSrc)) {
  copyDirSync(staticSrc, staticDest);
}

const publicSrc = path.join(webRoot, 'public');
const publicDest = path.join(standaloneRoot, 'public');
if (fs.existsSync(publicSrc)) {
  copyDirSync(publicSrc, publicDest);
}

require(path.join(standaloneRoot, 'server.js'));
