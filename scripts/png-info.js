import fs from 'node:fs/promises';

for (const filePath of process.argv.slice(2)) {
  const buffer = await fs.readFile(filePath);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    console.log(`${filePath}\tnot png`);
    continue;
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  console.log(`${filePath}\t${width}x${height}`);
}
