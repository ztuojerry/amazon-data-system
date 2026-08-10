import fs from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';

const filePath = process.argv[2];
if (!filePath) {
  throw new Error('Usage: node scripts/pdf-extract-text.js <pdf-path>');
}

const buffer = await fs.readFile(filePath);
const parser = new PDFParse({ data: buffer });
try {
  const data = await parser.getText();
  console.log(data.text);
} finally {
  await parser.destroy();
}
