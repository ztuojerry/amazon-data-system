import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const filePath = process.argv[2];
const outDir = process.argv[3] ?? 'tmp/pdf-pages';

if (!filePath) {
  throw new Error('Usage: node scripts/pdf-render-pages.js <pdf-path> [out-dir]');
}

await fs.mkdir(outDir, { recursive: true });
const buffer = await fs.readFile(filePath);
const parser = new PDFParse({ data: buffer });

try {
  const result = await parser.getScreenshot({ scale: 2, imageDataUrl: false, imageBuffer: true });
  for (const page of result.pages) {
    const pageNum = String(page.pageNumber ?? page.num ?? result.pages.indexOf(page) + 1).padStart(2, '0');
    const target = path.join(outDir, `page-${pageNum}.png`);
    await fs.writeFile(target, page.data);
    console.log(target);
  }
} finally {
  await parser.destroy();
}
