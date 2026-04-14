const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '.env.production')
    : path.join(__dirname, '.env');

if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
}

const app = express();

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ not found — run "npm run build" first');
    process.exit(1);
}

// Serve static assets with correct MIME types
app.use('/assets', express.static(path.join(distDir, 'assets'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js'))  res.setHeader('Content-Type', 'application/javascript');
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    }
}));

// Serve other static files (icons, fonts, manifest, etc.)
app.use(express.static(distDir, { index: false }));

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// SPA catch-all — return index.html for every non-asset route
app.get('*', (req, res) => {
    if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)$/)) {
        console.log(`❌ Static asset not found: ${req.url}`);
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(distDir, 'index.html'));
});

const port = process.env.PORT || 8090;
app.listen(port, () => {
    console.log(`Mixdeck server listening on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
