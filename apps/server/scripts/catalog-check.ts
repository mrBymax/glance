// Checks a catalog file: npm run catalog:check -- [catalog.json] [--lang it]
// With no path it reads CATALOG_PATH. The exit code is 1 with one error or more.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { checkCatalog, reportLines } from '../src/catalog/check';
import { DEFAULT_CATALOG_PATH } from '../src/config';

function main(): void {
  const { values, positionals } = parseArgs({ options: { lang: { type: 'string' } }, allowPositionals: true });
  if (values.lang !== undefined && values.lang !== 'en' && values.lang !== 'it') {
    throw new Error(`--lang must be "en" or "it". Got "${values.lang}".`);
  }
  const path = positionals[0] ?? (process.env.CATALOG_PATH || DEFAULT_CATALOG_PATH);

  let entries: unknown;
  try {
    entries = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read the catalog file ${path}: ${(error as Error).message}`, { cause: error });
  }
  const report = checkCatalog(entries, values.lang === undefined ? {} : { lang: values.lang });
  for (const line of reportLines(report)) console.log(line);
  if (report.errors.length > 0) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`catalog:check failed. ${(error as Error).message}`);
  process.exitCode = 1;
}
