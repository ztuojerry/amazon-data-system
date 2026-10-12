import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT || 4321);
const ROOT = path.resolve('amazon-dashboard');
const XYDC_MCP_URL = process.env.XYDC_MCP_URL || 'https://mcp.xydc.com/mcp';
const SOURCE_DIRS = [
  'd:\\Downloads\\Super Browser\\Vivian\\数据下载',
  'd:\\Downloads\\Super Browser\\晨曦云澳大利亚\\数据下载',
];

const COLUMN = {
  rank: '搜索频率排名',
  term: '搜索词',
  brand1: '点击量第1的品牌',
  brand2: '点击量第2的品牌',
  brand3: '点击量第3的品牌',
  category1: '点击量最高的分类',
  category2: '点击量第二的分类',
  category3: '点击量第 3 的分类',
  asin1: '点击量第1的商品：ASIN',
  title1: '点击量第1的商品: 商品标题',
  clickShare1: '点击量最高的商品：点击份额',
  conversion1: '点击量第1的商品：转化贡献占比',
  asin2: '点击量第2的商品：ASIN',
  title2: '点击量第2的商品：商品标题',
  clickShare2: '点击量第二的商品：点击份额',
  conversion2: '热门点击商品第2名：转化贡献占比',
  asin3: '点击量第三的商品：ASIN',
  title3: '点击量第3的商品：商品标题',
  clickShare3: '点击量第三的商品：点击份额',
  conversion3: '点击量第3的商品：转化贡献占比',
  reportDate: '报告日期',
};

const cache = new Map();

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/asin-keywords') {
      await handleAsinQuery(url, response);
      return;
    }
    if (url.pathname === '/api/xydc-keywords') {
      await handleXydcQuery(url, response);
      return;
    }
    serveStatic(url.pathname, response);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/asin-keywords.html`;
  console.log(`ASIN keyword tool: ${url}`);
  console.log(`Static file: ${pathToFileURL(path.join(ROOT, 'asin-keywords.html')).href}`);
});

async function handleAsinQuery(url, response) {
  const asin = normalizeAsin(url.searchParams.get('asin'));
  if (!asin) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Missing ASIN' }));
    return;
  }

  if (!cache.has(asin)) {
    cache.set(asin, scanAsin(asin));
  }
  const rows = await cache.get(asin);
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify({ asin, rows, generatedAt: new Date().toISOString() }));
}

async function handleXydcQuery(url, response) {
  const asin = normalizeAsin(url.searchParams.get('asin'));
  const marketplace = String(url.searchParams.get('marketplace') || 'US').toUpperCase();
  if (!asin) {
    writeJson(response, 400, { error: 'Missing ASIN' });
    return;
  }

  try {
    const payload = await fetchXydcAsinKeywords(asin, marketplace);
    writeJson(response, 200, payload);
  } catch (error) {
    writeJson(response, 200, {
      source: 'xydc',
      asin,
      marketplace,
      rows: [],
      tools: [],
      status: 'unavailable',
      message: error.message,
    });
  }
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function serveStatic(requestPath, response) {
  const cleanPath = decodeURIComponent(requestPath === '/' ? '/asin-keywords.html' : requestPath);
  const filePath = path.resolve(ROOT, `.${cleanPath}`);
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(response);
}

async function scanAsin(asin) {
  const rows = [];
  const files = sourceFiles();
  for (const file of files) {
    await scanFile(file, asin, rows);
  }
  return rows
    .sort((a, b) => Number(a.rank) - Number(b.rank) || Number(b.clickShare) - Number(a.clickShare))
    .slice(0, 1000);
}

async function fetchXydcAsinKeywords(asin, marketplace) {
  const token = getXydcToken();
  if (!token) {
    throw new Error('未找到 XYDC_MCP_TOKEN。请重启 Codex/终端，或确认用户环境变量已设置。');
  }

  const session = await createMcpSession(token);
  const toolsResult = await mcpRequest(token, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  }, session.sessionId);
  const tools = toolsResult?.result?.tools || [];
  const candidates = rankXydcTools(tools);
  const attempts = [];

  for (const tool of candidates.slice(0, 5)) {
    for (const args of xydcArgumentCandidates(asin, marketplace)) {
      try {
        const result = await mcpRequest(token, {
          jsonrpc: '2.0',
          id: 10 + attempts.length,
          method: 'tools/call',
          params: {
            name: tool.name,
            arguments: args,
          },
        }, session.sessionId);
        attempts.push({ tool: tool.name, args: Object.keys(args), ok: !result.error });
        if (!result.error) {
          return normalizeXydcResult(asin, marketplace, tool, result.result, tools, attempts);
        }
      } catch (error) {
        attempts.push({ tool: tool.name, args: Object.keys(args), ok: false, error: error.message });
      }
    }
  }

  return {
    source: 'xydc',
    asin,
    marketplace,
    rows: [],
    tools: tools.map(publicToolInfo),
    attempts,
    status: candidates.length ? 'no_matching_call' : 'no_candidate_tool',
    message: candidates.length
      ? '已连接西柚 MCP，但自动参数尝试未返回可解析数据。'
      : '已连接西柚 MCP，但未发现明显的 ASIN/关键词相关工具。',
  };
}

async function createMcpSession(token) {
  const result = await mcpRequest(token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'amazon-asin-keyword-tool', version: '0.1.0' },
    },
  });
  return { sessionId: result.sessionId };
}

async function mcpRequest(token, body, sessionId) {
  const { status, headers, text } = await curlJsonPost(token, body, sessionId);
  if (status < 200 || status >= 300) {
    throw new Error(`西柚 MCP HTTP ${status}: ${text.slice(0, 300)}`);
  }
  const parsed = parseMcpResponseText(text);
  if (parsed?.error) {
    throw new Error(parsed.error.message || JSON.stringify(parsed.error));
  }
  return { ...parsed, sessionId: headers['mcp-session-id'] || sessionId };
}

async function curlJsonPost(token, body, sessionId) {
  const headerLines = [
    'Authorization: Bearer __TOKEN__',
    'Accept: application/json, text/event-stream',
    'Content-Type: application/json',
  ];
  if (sessionId) headerLines.push(`mcp-session-id: ${sessionId}`);

  let output;
  try {
    output = execFileSync('curl.exe', [
      '--ssl-no-revoke',
      '-sS',
      '-i',
      '-X', 'POST',
      ...headerLines.flatMap((header) => ['-H', header.replace('__TOKEN__', token)]),
      '--data-binary', JSON.stringify(body),
      XYDC_MCP_URL,
    ], { encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024 * 20 });
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message || '').replaceAll(token, '[REDACTED]');
    throw new Error(`西柚 MCP curl 请求失败：${detail.slice(0, 500)}`);
  }
  const separator = output.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
  const parts = output.split(separator);
  const headerText = parts.shift() || '';
  const text = parts.join(separator);
  const status = Number((headerText.match(/HTTP\/\S+\s+(\d+)/) || [])[1]) || 0;
  const headers = {};
  for (const line of headerText.split(/\r?\n/).slice(1)) {
    const index = line.indexOf(':');
    if (index > 0) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return { status, headers, text };
}

function parseMcpResponseText(text) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const dataLine = trimmed.split(/\r?\n/).find((line) => line.startsWith('data:'));
  if (dataLine) return JSON.parse(dataLine.replace(/^data:\s*/, ''));
  throw new Error(`无法解析 MCP 响应：${trimmed.slice(0, 200)}`);
}

function rankXydcTools(tools) {
  return tools
    .map((tool) => {
      const haystack = `${tool.name || ''} ${tool.description || ''}`.toLowerCase();
      let score = 0;
      if (tool.name === 'get_asin_keywords') score += 100;
      if (tool.name === 'get_asin_keywords_daily') score += 40;
      if (tool.name === 'get_asin_keywords_monthly') score += 30;
      for (const keyword of ['asin', 'keyword', 'traffic', 'rank', 'ad', 'advertis', 'reverse']) {
        if (haystack.includes(keyword)) score += 2;
      }
      for (const keyword of ['关键词', '流量', '广告', '排名', '反查', '竞品', '自然']) {
        if (haystack.includes(keyword)) score += 3;
      }
      return { ...tool, _score: score };
    })
    .filter((tool) => tool._score > 0)
    .sort((a, b) => b._score - a._score);
}

function xydcArgumentCandidates(asin, marketplace) {
  return [
    { asin, country: marketplace },
    { asin, country: marketplace.toLowerCase() },
    { asin, marketplace },
    { asin, marketplace: marketplace.toLowerCase() },
    { asin, site: marketplace },
    { asin, country: marketplace },
    { asin, market: marketplace },
    { asins: [asin], marketplace },
    { keyword: asin, marketplace },
  ];
}

function normalizeXydcResult(asin, marketplace, tool, result, tools, attempts) {
  const rawText = extractMcpText(result);
  const rawJson = tryParseJson(rawText);
  const rows = normalizeXydcRows(rawJson ?? result);
  return {
    source: 'xydc',
    asin,
    marketplace,
    rows,
    rawText: rows.length ? undefined : rawText,
    tool: publicToolInfo(tool),
    tools: tools.map(publicToolInfo),
    attempts,
    status: rows.length ? 'ok' : 'unparsed',
    message: rows.length ? '已获取西柚洞察补充数据。' : '已调用西柚工具，但返回结构暂未映射成表格。',
  };
}

function extractMcpText(result) {
  const content = result?.content || [];
  const text = content
    .filter((item) => item?.type === 'text' && item.text)
    .map((item) => item.text)
    .join('\n');
  return text || JSON.stringify(result ?? {});
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeXydcRows(payload) {
  const rows = findArrayPayload(payload);
  if (!rows) return [];
  return rows.slice(0, 300).map((item) => ({
    term: pick(item, ['keyword', 'term', 'searchTerm', 'query', '关键词', '搜索词']),
    searchVolume: pick(item, ['searchVolume', 'volume', 'searches', '搜索量']) || item?.trafficSummary?.traffic?.total || '',
    trafficShare: pick(item, ['trafficShare', 'flowShare', '流量占比']) || item?.trafficSummary?.trafficAcquisitionRate?.total || '',
    organicRank: pick(item, ['organicRank', 'naturalRank', 'rank', '自然排名']) || bestRank(item?.ranks, ['or']),
    adRank: pick(item, ['adRank', 'sponsoredRank', '广告排名']) || bestRank(item?.ranks, ['sp', 'sb', 'sbv', 'sor']),
    ad: pick(item, ['ad', 'isAd', 'sponsored', '是否广告']) || hasRank(item?.ranks, ['sp', 'sb', 'sbv', 'sor']),
    source: '西柚洞察',
    raw: item,
  })).filter((row) => row.term || row.organicRank || row.adRank || row.searchVolume);
}

function bestRank(ranks, positions) {
  if (!Array.isArray(ranks)) return '';
  const values = ranks
    .filter((rank) => positions.includes(rank.position))
    .map((rank) => Number(rank.totalRank || rank.pageRank))
    .filter((rank) => Number.isFinite(rank) && rank > 0);
  return values.length ? Math.min(...values) : '';
}

function hasRank(ranks, positions) {
  return Array.isArray(ranks) && ranks.some((rank) => positions.includes(rank.position));
}

function findArrayPayload(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;
  for (const key of ['data', 'rows', 'items', 'list', 'keywords', 'result', 'results']) {
    const child = value[key];
    if (Array.isArray(child)) return child;
    const nested = findArrayPayload(child);
    if (nested) return nested;
  }
  return null;
}

function pick(record, keys) {
  for (const key of keys) {
    if (record && record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }
  return '';
}

function publicToolInfo(tool) {
  return {
    name: tool.name,
    description: tool.description,
  };
}

function getXydcToken() {
  if (process.env.XYDC_MCP_TOKEN) return process.env.XYDC_MCP_TOKEN;
  try {
    const output = execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      "(Get-ItemProperty -Path 'HKCU:\\Environment' -Name 'XYDC_MCP_TOKEN' -ErrorAction SilentlyContinue).XYDC_MCP_TOKEN",
    ], { encoding: 'utf8', timeout: 5000 });
    return output.trim();
  } catch {
    return '';
  }
}

async function scanFile(filePath, asin, rows) {
  const site = siteFromFile(filePath);
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  let headers = null;

  for await (const line of rl) {
    lineNumber += 1;
    if (lineNumber === 1 || !line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line).map(stripBom);
      continue;
    }
    if (!line.includes(asin)) continue;

    const record = makeRecord(headers, parseCsvLine(line));
    const positions = [
      { no: 1, asin: record[COLUMN.asin1], title: record[COLUMN.title1], clickShare: record[COLUMN.clickShare1], conversionShare: record[COLUMN.conversion1] },
      { no: 2, asin: record[COLUMN.asin2], title: record[COLUMN.title2], clickShare: record[COLUMN.clickShare2], conversionShare: record[COLUMN.conversion2] },
      { no: 3, asin: record[COLUMN.asin3], title: record[COLUMN.title3], clickShare: record[COLUMN.clickShare3], conversionShare: record[COLUMN.conversion3] },
    ];
    const hit = positions.find((item) => normalizeAsin(item.asin) === asin);
    if (!hit) continue;

    const competition = classifyCompetition(record);
    rows.push({
      site,
      reportDate: record[COLUMN.reportDate],
      term: record[COLUMN.term],
      rank: number(record[COLUMN.rank]),
      position: `点击第 ${hit.no}`,
      asin: hit.asin,
      title: hit.title,
      clickShare: number(hit.clickShare),
      conversionShare: number(hit.conversionShare),
      brands: [record[COLUMN.brand1], record[COLUMN.brand2], record[COLUMN.brand3]].filter(Boolean),
      categories: [record[COLUMN.category1], record[COLUMN.category2], record[COLUMN.category3]].filter(Boolean),
      competitors: positions.map((item) => item.asin).filter((value) => value && normalizeAsin(value) !== asin),
      competition,
      layout: recommendLayout(record, competition),
    });
  }
}

function sourceFiles() {
  const latestBySite = new Map();
  for (const dir of SOURCE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (/^[A-Z]{2}_热门搜索词_简单_Week_\d{4}_\d{2}_\d{2}\.csv$/i.test(name)) {
        const filePath = path.join(dir, name);
        const site = siteFromFile(filePath);
        const current = latestBySite.get(site);
        if (!current || reportTimeFromFile(filePath) > reportTimeFromFile(current)) {
          latestBySite.set(site, filePath);
        }
      }
    }
  }
  return [...latestBySite.values()].sort((a, b) => siteFromFile(a).localeCompare(siteFromFile(b)));
}

function reportDateFromFile(filePath) {
  const match = path.basename(filePath).match(/Week_(\d{4})_(\d{2})_(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function reportTimeFromFile(filePath) {
  const reportDate = reportDateFromFile(filePath);
  return reportDate ? new Date(`${reportDate}T00:00:00Z`).getTime() : 0;
}

function classifyCompetition(record) {
  const rank = number(record[COLUMN.rank]);
  const share1 = number(record[COLUMN.clickShare1]);
  const share2 = number(record[COLUMN.clickShare2]);
  const share3 = number(record[COLUMN.clickShare3]);
  const top3Share = share1 + share2 + share3;
  if (share1 >= 45 || top3Share >= 80 || (rank <= 100 && top3Share >= 55)) return '高';
  if (share1 >= 28 || top3Share >= 55 || rank <= 300) return '中';
  return '低';
}

function recommendLayout(record, competition) {
  const term = normalizeTerm(record[COLUMN.term]);
  const brandTokens = [record[COLUMN.brand1], record[COLUMN.brand2], record[COLUMN.brand3]]
    .flatMap((brand) => normalizeTerm(brand).split(/\s+/))
    .filter((token) => token.length >= 4);
  const brandTerm = brandTokens.some((token) => term === token || term.includes(` ${token} `));
  if (brandTerm || competition === '高') return '谨慎观察';
  if (competition === '低') return '文案+广告';
  return '广告测试';
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function makeRecord(headers, values) {
  const record = {};
  headers.forEach((header, index) => {
    record[header] = values[index] ?? '';
  });
  return record;
}

function siteFromFile(filePath) {
  return path.basename(filePath).split('_')[0].toUpperCase();
}

function normalizeAsin(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeTerm(value) {
  return ` ${String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

function number(value) {
  return Number(String(value || '').replace(/,/g, '').trim()) || 0;
}

function stripBom(value) {
  return String(value || '').replace(/^\uFEFF/, '');
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  }[ext] || 'application/octet-stream';
}
