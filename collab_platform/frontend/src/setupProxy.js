/**
 * setupProxy.js — CRA HTTP + WebSocket proxy to Django backend
 * 
 * The simple "proxy" key in package.json only handles HTTP.
 * This file uses http-proxy-middleware to also proxy WebSocket connections.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    // WebSocket proxy — /ws/* → ws://localhost:8000
    app.use(
        '/ws',
        createProxyMiddleware({
            target: 'http://localhost:8000',
            changeOrigin: true,
            ws: true,
        })
    );

    // HTTP API proxy — /api/* → http://localhost:8000
    app.use(
        '/api',
        createProxyMiddleware({
            target: 'http://localhost:8000',
            changeOrigin: true,
        })
    );
};
