import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import http from 'node:http';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const jsRoot = resolve(__dirname, '../..');
const distRoot = resolve(jsRoot, 'dist');
const port = Number(process.env.PORT || 8080);

loadLocalEnv();

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

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    return serveStatic(response, url.pathname);
  } catch (error) {
    if (response.writableEnded) return undefined;
    response.statusCode = error.status || 500;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      ok: false,
      error: {
        code: error.code || 'server_error',
        message: process.env.NODE_ENV === 'production' ? 'Server request failed safely.' : error.message,
      },
      meta: { source: 'server', isDemo: false, warnings: [] },
    }));
    return undefined;
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`StockProb-R listening on 0.0.0.0:${port}`);
});

async function handleApi(request, response, url) {
  const matchedDynamic = dynamicApiRoutes.find(([pattern]) => pattern.test(url.pathname));
  const route = apiRoutes.get(url.pathname) || matchedDynamic?.[1];
  if (!route) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ ok: false, error: { code: 'not_found', message: 'API route not found' }, meta: { source: 'server', warnings: [] } }));
    return undefined;
  }
  if (matchedDynamic) {
    const [, symbol] = url.pathname.match(matchedDynamic[0]);
    url.searchParams.set('symbol', decodeURIComponent(symbol));
  }
  request.query = Object.fromEntries(url.searchParams.entries());
  if (['POST', 'PUT', 'PATCH'].includes(request.method || '')) request.body = await readJsonBody(request);
  const handlerUrl = new URL(route, `${pathToFileURL(jsRoot).href}/`);
  const module = await import(handlerUrl.href);
  if (typeof module.default !== 'function') throw Object.assign(new Error(`${url.pathname} has no default handler`), { status: 500, code: 'handler_missing' });
  await module.default(request, createLocalResponse(response));
  if (!response.writableEnded) response.end();
  return undefined;
}

function serveStatic(response, pathname) {
  const requested = safeJoin(distRoot, pathname === '/' ? '/index.html' : pathname);
  const target = requested && existsSync(requested) && statSync(requested).isFile() ? requested : join(distRoot, 'index.html');
  if (!existsSync(target)) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('StockProb-R build output is missing. Run npm run build first.');
    return undefined;
  }
  response.statusCode = 200;
  response.setHeader('Content-Type', mime(target));
  if (target.endsWith('index.html')) response.setHeader('Cache-Control', 'no-store');
  else response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  createReadStream(target).pipe(response);
  return undefined;
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
  return new Promise((resolveBody, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(Object.assign(new Error('Request body too large'), { status: 413, code: 'payload_too_large' }));
    });
    request.on('end', () => {
      if (!raw.trim()) return resolveBody({});
      try {
        return resolveBody(JSON.parse(raw));
      } catch {
        return reject(Object.assign(new Error('Invalid JSON request body'), { status: 400, code: 'invalid_json' }));
      }
    });
    request.on('error', reject);
  });
}

function safeJoin(root, pathname) {
  const decoded = decodeURIComponent(pathname || '/');
  const target = normalize(join(root, decoded));
  return target.startsWith(root) ? target : null;
}

function mime(path) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  };
  return types[extname(path).toLowerCase()] || 'application/octet-stream';
}

function loadLocalEnv() {
  if (process.env.NODE_ENV === 'production') return;
  const envPath = join(jsRoot, '.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=').replace(/^["']|["']$/g, '');
  }
}
