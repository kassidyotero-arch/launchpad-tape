// Cloudflare Worker / Pages: Secure API Proxy for RAEN Foundation
// This file lives in the root directory alongside index.html.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Proxy RAEN requests (/api/raen/trades, /api/raen/alerts, etc.)
    if (url.pathname.startsWith('/api/raen')) {
      const subpath = url.pathname.replace(/^\/api\/raen/, '') || '/trades';
      const targetUrl = 'https://raen.foundation/api/public/v1' + subpath + url.search;

      // Priority: Client Authorization header > Secret Environment Variable RAEN_API_KEY
      let authHeader = request.headers.get('Authorization');
      if (!authHeader && env && env.RAEN_API_KEY) {
        authHeader = 'Bearer ' + env.RAEN_API_KEY.trim();
      }

      if (!authHeader) {
        return new Response(JSON.stringify({
          error: 'Missing RAEN_API_KEY. Please configure RAEN_API_KEY in Cloudflare Settings -> Variables and Secrets.',
          healthy: null,
          trades: [],
          alerts: [],
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const reqHeaders = new Headers();
      reqHeaders.set('Authorization', authHeader);
      reqHeaders.set('Accept', 'application/json');

      try {
        const res = await fetch(targetUrl, {
          method: request.method,
          headers: reqHeaders,
        });

        const resHeaders = new Headers(res.headers);
        resHeaders.set('Access-Control-Allow-Origin', '*');
        resHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: resHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Proxy request failed: ' + err.message }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Pass through all other requests to static assets (index.html, etc.)
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return fetch(request);
  },
};
