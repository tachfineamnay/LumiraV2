const path = require('path');

// Keep Playwright isolated from any developer server running on the default port.
process.env.PORT = process.env.PLAYWRIGHT_WEB_PORT || '3100';
process.env.HOSTNAME = process.env.HOSTNAME || '127.0.0.1';

require(path.resolve(__dirname, '../apps/web/.next/standalone/apps/web/server.js'));
