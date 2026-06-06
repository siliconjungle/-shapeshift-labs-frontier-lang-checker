import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const self = fileURLToPath(import.meta.url);
const centralCandidates = [
  process.env.FRONTIER_PACKAGE_README_SCRIPT,
  path.resolve(packageRoot, '..', 'json-diff', 'benchmarks', 'package-readme-sections.js'),
  path.resolve(packageRoot, '..', '..', 'benchmarks', 'package-readme-sections.js')
].filter(Boolean);

let delegated = false;
for (const candidate of centralCandidates) {
  const resolved = path.resolve(candidate);
  if (resolved !== self && fs.existsSync(resolved)) {
    await import(pathToFileURL(resolved).href);
    delegated = true;
    break;
  }
}

if (!delegated) {
  const { runPackageReadmeSections } = await import('./package-readme-generator.mjs');
  runPackageReadmeSections({
    packageRoot,
    check: process.argv.slice(2).includes('--check')
  });
}
