import { copyFile, mkdir } from 'node:fs/promises';

const source = new URL('../showcase/', import.meta.url);
const output = new URL('../dist/showcase/', import.meta.url);

await mkdir(output, { recursive: true });
await Promise.all(['index.html', 'styles.css'].map(file =>
  copyFile(new URL(file, source), new URL(file, output)),
));
