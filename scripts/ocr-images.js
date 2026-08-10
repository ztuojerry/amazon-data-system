import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const tesseract = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
const tessdataDir = path.resolve('tmp/tessdata');
const outDir = path.resolve('tmp/ocr');

const images = [
  ['AU', 'd:\\Downloads\\Super Browser\\晨曦云澳大利亚\\澳大利亚配送费表_00.png'],
  ['CA', 'd:\\Downloads\\Super Browser\\晨曦云澳大利亚\\加拿大配送费率表_00.png'],
  ['US', 'd:\\Downloads\\Super Browser\\晨曦云澳大利亚\\美国配送费率表_00.png']
];

await fs.mkdir(outDir, { recursive: true });

for (const [site, imagePath] of images) {
  const text = await ocrImage(imagePath, site);
  const target = path.join(outDir, `${site}-delivery-fees.txt`);
  await fs.writeFile(target, text, 'utf8');
  console.log(`${site}\t${target}\t${text.length} chars`);
}

async function ocrImage(imagePath, site) {
  const metadata = await sharp(imagePath).metadata();
  if (!metadata.height || metadata.height <= 24000) {
    return runTesseract(imagePath);
  }

  const chunkDir = path.join(outDir, `${site}-chunks`);
  await fs.mkdir(chunkDir, { recursive: true });

  const chunkHeight = 8000;
  const chunks = [];
  for (let top = 0; top < metadata.height; top += chunkHeight) {
    const height = Math.min(chunkHeight, metadata.height - top);
    const target = path.join(chunkDir, `${site}-${String(chunks.length + 1).padStart(2, '0')}.png`);
    await sharp(imagePath)
      .extract({ left: 0, top, width: metadata.width, height })
      .toFile(target);
    chunks.push(target);
  }

  const parts = [];
  for (const chunk of chunks) {
    parts.push(await runTesseract(chunk));
  }
  return parts.join('\n\n');
}

function runTesseract(imagePath) {
  return new Promise(async (resolve, reject) => {
    const outBase = path.join(outDir, `ocr-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const child = spawn(tesseract, [
      imagePath,
      outBase,
      '-l',
      'chi_sim+eng',
      '--tessdata-dir',
      tessdataDir,
      '--psm',
      '6'
    ], {
      windowsHide: true
    });

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', async (code) => {
      const textPath = `${outBase}.txt`;
      try {
        const text = await fs.readFile(textPath, 'utf8');
        await fs.rm(textPath, { force: true });
        resolve(text);
      } catch {
        if (code !== 0) {
          reject(new Error(`tesseract exited ${code}: ${stderr}`));
          return;
        }
        reject(new Error(`tesseract exited ${code}: ${stderr}`));
      }
    });
  });
}
