import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const SOURCE = path.resolve('数据下载', '新品机会筛选', '新品机会_汇总.csv');
const OUTPUT = path.resolve('amazon-dashboard', 'data', 'asin-keyword-data.js');
const MAX_TERMS_PER_ASIN = 80;
const MAX_ASINS = 8000;

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`未找到 ${SOURCE}，请先运行 npm.cmd run search:opportunities`);
  }

  const asins = new Map();
  const stream = fs.createReadStream(SOURCE, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line).map(stripBom);
      continue;
    }

    const record = makeRecord(headers, parseCsvLine(line));
    const positions = [
      { no: 1, asin: record.ASIN1, title: record['标题1'] },
      { no: 2, asin: record.ASIN2, title: record['标题2'] },
      { no: 3, asin: record.ASIN3, title: record['标题3'] },
    ];

    for (const hit of positions) {
      const asin = normalizeAsin(hit.asin);
      if (!asin) continue;
      if (!asins.has(asin)) asins.set(asin, []);
      const rows = asins.get(asin);
      if (rows.length >= MAX_TERMS_PER_ASIN) continue;
      rows.push({
        site: record['站点'],
        reportDate: record['报告日期'],
        term: record['搜索词'],
        rank: number(record['搜索频率排名']),
        position: `点击第 ${hit.no}`,
        asin,
        title: hit.title,
        clickShare: hit.no === 1 ? number(record['第一商品点击份额']) : 0,
        conversionShare: 0,
        brands: splitPiped(record['点击前三品牌']),
        categories: splitPiped(record['点击前三分类']),
        competitors: positions.map((item) => normalizeAsin(item.asin)).filter((value) => value && value !== asin),
        competition: record['竞争度'],
        layout: layoutFromRecord(record),
      });
    }
  }

  const sortedEntries = [...asins.entries()]
    .filter(([, rows]) => rows.length)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_ASINS);

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: [path.relative(process.cwd(), SOURCE)],
    asins: Object.fromEntries(sortedEntries.map(([asin, rows]) => [
      asin,
      { rows: rows.sort((a, b) => a.rank - b.rank).slice(0, MAX_TERMS_PER_ASIN) },
    ])),
  };

  fs.writeFileSync(OUTPUT, `window.ASIN_KEYWORD_DATA = ${JSON.stringify(payload)};\n`, 'utf8');
  console.log(`完成：${OUTPUT}`);
  console.log(`ASIN 数：${sortedEntries.length}`);
}

function layoutFromRecord(record) {
  if (record['状态'] === '优先验证' && record['竞争度'] === '低' && record['是否品牌词'] === '否') return '文案+广告';
  if (record['竞争度'] === '高' || record['是否品牌词'] === '是') return '谨慎观察';
  return '广告测试';
}

function splitPiped(value) {
  return String(value || '').split('|').map((item) => item.trim()).filter(Boolean);
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

function normalizeAsin(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function number(value) {
  return Number(String(value || '').replace(/,/g, '').trim()) || 0;
}

function stripBom(value) {
  return String(value || '').replace(/^\uFEFF/, '');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
