const XYDC_MCP_URL = process.env.XYDC_MCP_URL || 'https://mcp.xydc.com/mcp';

export default async function handler(request, response) {
  setCors(response);
  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  const asin = normalizeAsin(request.query?.asin);
  const marketplace = String(request.query?.marketplace || 'US').toUpperCase();
  if (!asin) {
    response.status(400).json({ status: 'error', message: 'Missing ASIN', rows: [] });
    return;
  }

  try {
    const payload = await fetchXydcAsinKeywords(asin, marketplace);
    response.status(200).json(payload);
  } catch (error) {
    response.status(200).json({
      source: 'xydc',
      asin,
      marketplace,
      rows: [],
      status: 'unavailable',
      message: safeError(error),
    });
  }
}

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
}

async function fetchXydcAsinKeywords(asin, marketplace) {
  const token = process.env.XYDC_MCP_TOKEN;
  if (!token) throw new Error('Server missing XYDC_MCP_TOKEN');

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
        attempts.push({ tool: tool.name, args: Object.keys(args), ok: false, error: safeError(error) });
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
      clientInfo: { name: 'amazon-asin-keyword-vercel', version: '0.1.0' },
    },
  });
  return { sessionId: result.sessionId };
}

async function mcpRequest(token, body, sessionId) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const response = await fetch(XYDC_MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`XYDC MCP HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  const parsed = parseMcpResponseText(text);
  if (parsed?.error) {
    throw new Error(parsed.error.message || JSON.stringify(parsed.error));
  }
  return { ...parsed, sessionId: response.headers.get('mcp-session-id') || sessionId };
}

function parseMcpResponseText(text) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const dataLines = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, '').trim())
    .filter((line) => line && line !== '[DONE]');
  if (dataLines.length) return JSON.parse(dataLines.at(-1));
  throw new Error(`Cannot parse MCP response: ${trimmed.slice(0, 200)}`);
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

function normalizeAsin(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function safeError(error) {
  const token = process.env.XYDC_MCP_TOKEN || '';
  return String(error?.message || error || 'Unknown error').replaceAll(token, '[REDACTED]');
}
