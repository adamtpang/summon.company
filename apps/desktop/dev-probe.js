// Dev-only: run the shell alongside an installed Summon instance by using a
// separate userData dir (separate single-instance lock). Used to verify icon
// and tray changes without touching the installed app or the live server.
// Run: node_modules\.bin\electron dev-probe.js
const { app } = require('electron');
const path = require('path');
app.setPath('userData', path.join(app.getPath('temp'), 'summon-dev-probe'));
require('./main.js');
