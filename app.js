const url = require('url');
const path = require('path');
const fs = require('fs').promises;
const querystring = require('querystring');
const yaml = require('js-yaml');

// 3rd party modules
const express = require('express');
const express_async_errors = require('express-async-errors');
const morgan = require('morgan');

// Project variables
global.PUBLIC_DIR = process.env.PUBLIC_DIR ? process.env.PUBLIC_DIR : path.join(__dirname, 'public');
global.ISO_DIR = path.join(PUBLIC_DIR, 'iso');
global.KS_DIR = path.join(PUBLIC_DIR, 'ks');
global.MNT_DIR = '/mnt';
try {
    const fss = require('fs');
    const fileContents = fss.readFileSync('./settings.yaml', 'utf8');
    global.settings = yaml.safeLoad(fileContents);
    console.log(global.settings?.title);
    // console.log(yaml.safeDump(global.settings));
} catch (e) {
    console.log('Failed to load config file');
    console.log(e);
}

// Project routes
const route_api = require('./routes/api');
const route_page = require('./routes/page');
const route_mount = require('./routes/mount');
const route_ipxeMenu = require('./routes/ipxe-menu');
const route_ipxeBoot = require('./routes/ipxe-boot');
const route_ipxeKs = require('./routes/ipxe-ks');
const route_redirect = require('./routes/route_redirect');
const app = express();

// Use morgan to log every connections
app.use(morgan(':date[iso] :method :url :status'));
// Parse URL and identify the informaion and types of OS distribution
app.use(['/ipxe/ks', '/ipxe', '/iso', '/raw/iso'], (req, res, next) => {
    const uri = querystring.unescape(url.parse(req.url).pathname)
                .replace(new RegExp('/$'), '')            // Remove ending slash
                .replace(new RegExp('_init_.ipxe$'), '')  // Remove ending _init_.ipxe
                .replace(new RegExp('.ipxe$'), '');       // Remove ending .ipxe
    const urlParts = uri.split('/').filter(x => x !== '');
    req.info = {
        'os': (urlParts.length != 0) ? urlParts[0] : undefined,
        'distribution': (urlParts.length >= 2 && urlParts[0] == 'linux') ?
                            urlParts[1].toLowerCase().match(/\w*/g)[0] :
                            undefined,
        'isISO': uri.endsWith('.iso'),
        'route': urlParts.join('/'),
    }
    next();
});

// Serve dynamic generated pathes first
app.use('/api', route_api);
// Serve static files under raw API
app.use('/raw', express.static(PUBLIC_DIR));

// Serve ipxe menu for kickstart under ipxe API
app.use('/ipxe/ks', route_ipxeKs);
// Serve ipxe menu scripts under ipxe API
app.use('/ipxe', route_ipxeMenu);
// Serve ipxe boot scripts under ipxe API
app.use('/ipxe', route_ipxeBoot);

// Middleware for auto-mounting files under this route
app.use('/iso', route_mount);
// Middleware for redirecting pages when some patches are required
app.use('/', route_redirect);

// Lastly call render functions to render web pages
app.use('/', route_page);

// Handle any error and exceptions here to prevent debug message and information leaks
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.code == 'ENOENT')
        res.status(404).send('No such file or directory. Please review server log.');
    else
        res.status(500).send('Something broke on server side! Please review server log.');
});

// Start up a server with port 3000
app.listen(
    port = (process.env.PORT || '3000'),
    () => console.log(`Listening on port ${port} and directory ${global.PUBLIC_DIR}`)
);
