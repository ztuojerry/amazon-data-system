import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const SOURCE_DIRS = [
  'd:\\Downloads\\Super Browser\\Vivian\\数据下载',
  'd:\\Downloads\\Super Browser\\晨曦云澳大利亚\\数据下载',
];

const OUTPUT_DIR = path.resolve('数据下载', '新品机会筛选');
const MAX_ROWS_PER_SITE = 5000;
const CANDIDATE_BUFFER_LIMIT = MAX_ROWS_PER_SITE * 3;

const BRAND_STOPWORDS = new Set([
  '-', 'and', 'the', 'for', 'with', 'official', 'store', 'brand', 'amazon',
]);

const EXTRA_BRAND_WORDS = new Set([
  'lego', 'crocs', 'kindle', 'apple', 'nike', 'adidas', 'samsung', 'sony',
  'levoit', 'blueair', 'kleenex', 'quilton', 'dyson', 'anker', 'stanley',
  'owala', 'yeti', 'nintendo', 'playstation', 'xbox', 'fitbit', 'garmin',
]);

const LIGHTWEIGHT_CATEGORY_HINTS = [
  'beauty', 'health', 'personal care', 'kitchen', 'home', 'office', 'toys',
  'baby', 'pet', 'arts', 'craft', 'stationery', 'apparel', 'shoes', 'jewelry',
  'watches', 'lawn', 'garden', 'sports', 'outdoors',
];

const BULKY_OR_HIGH_COST_CATEGORY_HINTS = [
  'furniture', 'appliances', 'automotive', 'electronics', 'computers',
  'television', 'large', 'mattress', 'bedding', 'tools', 'home improvement',
  'musical instruments',
];

const BULKY_OR_HIGH_COST_TERMS = [
  'chair', 'desk', 'table', 'sofa', 'couch', 'mattress', 'bed frame',
  'shelf', 'shelving', 'cabinet', 'dresser', 'fridge', 'freezer',
  'refrigerator', 'washer', 'dryer', 'vacuum', 'monitor', 'tv', 'television',
  'laptop', 'ipad', 'phone', 'iphone', 'generator', 'treadmill', 'bike',
  'bicycle', 'helmet', 'car seat', 'stroller',
];

const LOW_COST_TERM_HINTS = [
  'cover', 'case', 'bag', 'holder', 'organizer', 'brush', 'clip', 'sticker',
  'tape', 'mat', 'pad', 'filter', 'refill', 'bottle', 'cup', 'spoon', 'socks',
  'gloves', 'toy', 'squishy', 'cube', 'pouch', 'strap', 'band', 'cable',
  'adapter', 'decor', 'paper', 'tissue', 'wipe', 'scrub', 'comb', 'spatula',
];

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseNumber(value) {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsvRow(values) {
  return values.map(csvEscape).join(',');
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

function reportDateFromFile(filePath) {
  const match = path.basename(filePath).match(/Week_(\d{4})_(\d{2})_(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function tokenSet(text) {
  return new Set(normalize(text).split(/\s+/).filter(Boolean));
}

function getBrandTokens(record) {
  const brands = [
    record['点击量第1的品牌'],
    record['点击量第2的品牌'],
    record['点击量第3的品牌'],
  ];
  const tokens = new Set();
  for (const brand of brands) {
    for (const token of tokenSet(brand)) {
      if (!BRAND_STOPWORDS.has(token) && token.length > 1) tokens.add(token);
    }
  }
  return tokens;
}

function isLikelyBrandTerm(term, record) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return true;
  const termTokens = tokenSet(term);
  const brandTokens = getBrandTokens(record);

  if (EXTRA_BRAND_WORDS.has(normalizedTerm)) return true;
  for (const token of termTokens) {
    if (EXTRA_BRAND_WORDS.has(token)) return true;
  }

  for (const brandToken of brandTokens) {
    if (normalizedTerm === brandToken) return true;
    if (termTokens.has(brandToken) && brandToken.length >= 4) return true;
  }

  return false;
}

function categoryText(record) {
  return normalize([
    record['点击量最高的分类'],
    record['点击量第二的分类'],
    record['点击量第 3 的分类'],
  ].join(' '));
}

function hasAny(text, hints) {
  return hints.some((hint) => text.includes(hint));
}

function classifySizeCost(term, record) {
  const categories = categoryText(record);
  const normalizedTerm = normalize(term);
  const negative = hasAny(categories, BULKY_OR_HIGH_COST_CATEGORY_HINTS)
    || hasAny(normalizedTerm, BULKY_OR_HIGH_COST_TERMS);
  const lightweight = !negative && hasAny(categories, LIGHTWEIGHT_CATEGORY_HINTS);
  const lowCostLikely = !negative && hasAny(normalizedTerm, LOW_COST_TERM_HINTS);

  return {
    lightweight,
    lowCostLikely,
    reason: negative
      ? '疑似大件或高成本，需排除'
      : lightweight && lowCostLikely
        ? '类目轻小且关键词偏低成本'
        : lightweight
          ? '类目偏轻小，成本需验证'
          : '轻小/成本不确定',
  };
}

function competition(record) {
  const rank = parseNumber(record['搜索频率排名']);
  const share1 = parseNumber(record['点击量最高的商品：点击份额']);
  const share2 = parseNumber(record['点击量第二的商品：点击份额']);
  const share3 = parseNumber(record['点击量第三的商品：点击份额']);
  const top3Share = share1 + share2 + share3;
  const brands = [
    normalize(record['点击量第1的品牌']),
    normalize(record['点击量第2的品牌']),
    normalize(record['点击量第3的品牌']),
  ].filter(Boolean);
  const uniqueBrandCount = new Set(brands).size;

  let level = '低';
  const reasons = [];

  if (rank <= 100) reasons.push('搜索频率排名极高');
  if (share1 >= 35) reasons.push('第一商品点击份额偏高');
  if (top3Share >= 70) reasons.push('前三商品点击过于集中');
  if (uniqueBrandCount <= 1 && brands.length >= 2) reasons.push('头部品牌集中');

  if (share1 >= 45 || top3Share >= 80 || (rank <= 100 && top3Share >= 55)) {
    level = '高';
  } else if (share1 >= 28 || top3Share >= 55 || uniqueBrandCount <= 1 || rank <= 300) {
    level = '中';
  }

  return {
    rank,
    share1,
    top3Share: Number(top3Share.toFixed(2)),
    uniqueBrandCount,
    level,
    reason: reasons.join('；') || '头部点击未明显垄断',
  };
}

function scoreOpportunity(record) {
  const term = record['搜索词'];
  const sizeCost = classifySizeCost(term, record);
  const comp = competition(record);
  const brandTerm = isLikelyBrandTerm(term, record);

  let score = 60;
  if (brandTerm) score -= 45;
  if (sizeCost.lightweight) score += 15;
  if (sizeCost.lowCostLikely) score += 10;
  if (comp.level === '低') score += 15;
  if (comp.level === '中') score += 4;
  if (comp.level === '高') score -= 30;
  if (comp.rank > 300 && comp.rank <= 20000) score += 8;
  if (comp.rank > 20000 && comp.rank <= 200000) score += 4;
  if (comp.rank > 200000) score -= 8;

  const excluded = brandTerm || !sizeCost.lightweight || comp.level === '高';
  const status = excluded ? '二线观察' : '优先验证';

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    status,
    brandTerm,
    sizeCost,
    comp,
  };
}

function compareCandidate(a, b) {
  return b.score - a.score || a.rank - b.rank;
}

function trimCandidates(candidates) {
  if (candidates.length <= CANDIDATE_BUFFER_LIMIT) return;
  candidates.sort(compareCandidate);
  candidates.length = MAX_ROWS_PER_SITE;
}

async function findSourceFiles() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (/^[A-Z]{2}_热门搜索词_简单_Week_\d{4}_\d{2}_\d{2}\.csv$/i.test(name)) {
        files.push(path.join(dir, name));
      }
    }
  }
  return files;
}

async function analyzeFile(filePath, writers, summaries) {
  const site = siteFromFile(filePath);
  const fileReportDate = reportDateFromFile(filePath);
  let headers = null;
  let lineNumber = 0;
  let total = 0;
  let kept = 0;
  let priority = 0;
  const candidates = [];

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineNumber += 1;
    if (lineNumber === 1 || !line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }

    total += 1;
    const record = makeRecord(headers, parseCsvLine(line));
    const result = scoreOpportunity(record);

    if (result.score < 45) continue;
    kept += 1;
    if (result.status === '优先验证') priority += 1;

    candidates.push({
      site,
      reportDate: record['报告日期'] || fileReportDate,
      term: record['搜索词'],
      rank: result.comp.rank,
      score: result.score,
      status: result.status,
      competition: result.comp.level,
      top1Share: result.comp.share1,
      top3Share: result.comp.top3Share,
      brandTerm: result.brandTerm ? '是' : '否',
      lightweight: result.sizeCost.lightweight ? '是' : '否',
      lowCostLikely: result.sizeCost.lowCostLikely ? '是' : '否',
      sizeCostReason: result.sizeCost.reason,
      competitionReason: result.comp.reason,
      brands: [
        record['点击量第1的品牌'],
        record['点击量第2的品牌'],
        record['点击量第3的品牌'],
      ].filter(Boolean).join(' | '),
      categories: [
        record['点击量最高的分类'],
        record['点击量第二的分类'],
        record['点击量第 3 的分类'],
      ].filter(Boolean).join(' | '),
      asin1: record['点击量第1的商品：ASIN'],
      title1: record['点击量第1的商品: 商品标题'],
      asin2: record['点击量第2的商品：ASIN'],
      title2: record['点击量第2的商品：商品标题'],
      asin3: record['点击量第三的商品：ASIN'],
      title3: record['点击量第3的商品：商品标题'],
      nextCheck: '需二次验证：近半年上架、评论数<=200、采购成本<12元',
    });
    trimCandidates(candidates);
  }

  candidates
    .sort(compareCandidate)
    .slice(0, MAX_ROWS_PER_SITE)
    .forEach((row) => {
      const values = [
        row.site,
        row.reportDate,
        row.term,
        row.rank,
        row.score,
        row.status,
        row.competition,
        row.top1Share,
        row.top3Share,
        row.brandTerm,
        row.lightweight,
        row.lowCostLikely,
        row.sizeCostReason,
        row.competitionReason,
        row.brands,
        row.categories,
        row.asin1,
        row.title1,
        row.asin2,
        row.title2,
        row.asin3,
        row.title3,
        row.nextCheck,
      ];
      writers.combined.write(`${toCsvRow(values)}\n`);
      writers.bySite.get(site).write(`${toCsvRow(values)}\n`);
    });

  summaries.push({
    site,
    file: path.basename(filePath),
    total,
    kept,
    priority,
    outputRows: Math.min(candidates.length, MAX_ROWS_PER_SITE),
  });
}

function writeSummary(summaries) {
  const lines = [
    '# 新品机会筛选报告',
    '',
    `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '',
    '## 筛选口径',
    '',
    '- 排除明显品牌词：搜索词命中头部品牌或常见品牌词时降权。',
    '- 保留轻小件倾向：优先 Beauty、Health、Kitchen、Home、Office、Pet、Toys、Baby、Apparel 等类目。',
    '- 采购成本低于 12 元：第一版只能按关键词和类目做“低成本倾向”判断，需结合供应链报价二次验证。',
    '- 非高竞争词：第一商品点击份额、前三商品点击集中度、头部品牌集中度过高时排除或降权。',
    '- 新品机会：第一版输出候选词和前三 ASIN，近半年上架、评论数 <= 200 需要 Keepa/SP-API/人工检查补齐。',
    '',
    '## 输出文件',
    '',
    '- `新品机会_汇总.csv`：所有站点合并结果。',
    '- `新品机会_US.csv` / `新品机会_CA.csv` / `新品机会_AU.csv`：各站点结果。',
    '',
    '## 本次处理',
    '',
    '| 站点 | 源文件 | 原始行数 | 初筛保留 | 优先验证 | 输出行数 |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...summaries.map((item) => (
      `| ${item.site} | ${item.file} | ${item.total} | ${item.kept} | ${item.priority} | ${item.outputRows} |`
    )),
    '',
  ];

  fs.writeFileSync(path.join(OUTPUT_DIR, '筛选说明.md'), `\uFEFF${lines.join('\n')}`, 'utf8');
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const files = await findSourceFiles();
  if (files.length === 0) {
    throw new Error('没有找到热门搜索词 CSV 文件。');
  }

  const outputHeader = [
    '站点',
    '报告日期',
    '搜索词',
    '搜索频率排名',
    '机会评分',
    '状态',
    '竞争度',
    '第一商品点击份额',
    '前三商品点击份额',
    '是否品牌词',
    '是否轻小件倾向',
    '是否低成本倾向',
    '轻小/成本判断',
    '竞争判断',
    '点击前三品牌',
    '点击前三分类',
    'ASIN1',
    '标题1',
    'ASIN2',
    '标题2',
    'ASIN3',
    '标题3',
    '下一步验证',
  ];

  const sites = [...new Set(files.map(siteFromFile))].sort();
  const writers = {
    combined: fs.createWriteStream(path.join(OUTPUT_DIR, '新品机会_汇总.csv'), { encoding: 'utf8' }),
    bySite: new Map(),
  };
  writers.combined.write(`\uFEFF${toCsvRow(outputHeader)}\n`);
  for (const site of sites) {
    const writer = fs.createWriteStream(path.join(OUTPUT_DIR, `新品机会_${site}.csv`), { encoding: 'utf8' });
    writer.write(`\uFEFF${toCsvRow(outputHeader)}\n`);
    writers.bySite.set(site, writer);
  }

  const summaries = [];
  for (const file of files) {
    await analyzeFile(file, writers, summaries);
  }

  await Promise.all([
    new Promise((resolve) => writers.combined.end(resolve)),
    ...[...writers.bySite.values()].map((writer) => new Promise((resolve) => writer.end(resolve))),
  ]);

  writeSummary(summaries.sort((a, b) => a.site.localeCompare(b.site)));
  console.log(`完成：${OUTPUT_DIR}`);
  for (const item of summaries) {
    console.log(`${item.site}: 原始 ${item.total} 行，初筛 ${item.kept} 行，优先验证 ${item.priority} 行，输出 ${item.outputRows} 行`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
