import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { pathToFileURL } from 'node:url';

const apiRoutes = new Map([
  ['/api/outperform', './api/outperform.js'],
  ['/api/price', './api/price.js'],
  ['/api/health', './api/health.js'],
  ['/api/universe', './api/universe.js'],
  ['/api/rank', './api/rank.js'],
  ['/api/backtest', './api/backtest.js'],
  ['/api/model/report', './api/model/report.js'],
  ['/api/cron/nightly', './api/cron/nightly.js'],
  ['/api/system/health', './api/system/health.js'],
  ['/api/system/providers', './api/system/providers.js'],
  ['/api/system/queues', './api/system/queues.js'],
  ['/api/system/staleness', './api/system/staleness.js'],
  ['/api/system/memory', './api/system/memory.js'],
  ['/api/universe/coverage', './api/universe/coverage.js'],
  ['/api/market/benchmarks', './api/market/benchmarks.js'],
  ['/api/stream/quotes', './api/stream/quotes.js'],
  ['/api/stream/probabilities', './api/stream/probabilities.js'],
  ['/api/stream/dashboard', './api/stream/dashboard.js'],
  ['/api/stream/system', './api/stream/system.js'],
  ['/api/stream/provider-health', './api/stream/provider-health.js'],
  ['/api/stream/memory', './api/stream/memory.js'],
]);

const dynamicApiRoutes = [
  [/^\/api\/dashboard\/([^/]+)\/snapshot$/, './api/dashboard/[symbol]/snapshot.js'],
  [/^\/api\/dashboard\/([^/]+)\/refresh$/, './api/dashboard/[symbol]/refresh.js'],
  [/^\/api\/market\/quote\/([^/]+)$/, './api/market/quote/[symbol].js'],
  [/^\/api\/market\/ohlcv\/([^/]+)$/, './api/market/ohlcv/[symbol].js'],
  [/^\/api\/market\/technicals\/([^/]+)$/, './api/market/technicals/[symbol].js'],
  [/^\/api\/probabilities\/([^/]+)$/, './api/probabilities/[symbol].js'],
  [/^\/api\/charts\/price\/([^/]+)$/, './api/charts/price/[symbol].js'],
];

const root = process.cwd();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [react(), localApiPlugin()],
  };
});

function localApiPlugin() {
  return {
    name: 'stockprob-local-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          const url = new URL(request.url || '/', 'http://localhost');
          const matchedDynamic = dynamicApiRoutes.find(([pattern]) => pattern.test(url.pathname));
          const route = apiRoutes.get(url.pathname) || matchedDynamic?.[1];
          if (!route) return next();
          if (matchedDynamic) {
            const [, symbol] = url.pathname.match(matchedDynamic[0]);
            url.searchParams.set('symbol', decodeURIComponent(symbol));
          }

          const handlerUrl = new URL(route, `${pathToFileURL(root).href}/`);
          handlerUrl.searchParams.set('t', String(Date.now()));
          const handlerModule = await import(handlerUrl.href);
          const handler = handlerModule.default;
          if (typeof handler !== 'function') {
            response.statusCode = 500;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'local_handler_missing', message: `${url.pathname} has no default handler` }));
            return undefined;
          }

          request.query = Object.fromEntries(url.searchParams.entries());
          if (['POST', 'PUT', 'PATCH'].includes(request.method || '')) {
            request.body = await readJsonBody(request);
          }

          const localResponse = createLocalResponse(response);
          await handler(request, localResponse);
          if (!response.writableEnded) response.end();
          return undefined;
        } catch (error) {
          if (response.writableEnded) return undefined;
          response.statusCode = error.status || 500;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({
            error: error.code || 'local_api_failed',
            message: error.message || 'Local API handler failed',
          }));
          return undefined;
        }
      });
    },
  };
}

function createLocalResponse(response) {
  return {
    setHeader(name, value) {
      response.setHeader(name, value);
      return this;
    },
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(payload) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(payload));
      return this;
    },
    write(payload) {
      response.write(String(payload ?? ''));
      return this;
    },
    end(payload) {
      if (payload === undefined) response.end();
      else response.end(String(payload ?? ''));
      return this;
    },
    send(payload) {
      if (typeof payload === 'object') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify(payload));
      } else {
        response.end(String(payload ?? ''));
      }
      return this;
    },
  };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(Object.assign(new Error('Request body too large'), { status: 413, code: 'payload_too_large' }));
    });
    request.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        return resolve(JSON.parse(raw));
      } catch {
        return reject(Object.assign(new Error('Invalid JSON request body'), { status: 400, code: 'invalid_json' }));
      }
    });
    request.on('error', reject);
  });
}
