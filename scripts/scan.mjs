// Runs the checks n8n applies when reviewing a new version of a community package, before it is published.
// `npx @n8n/scan-community-package` only scans versions already on npm, so this lints the local source and the
// packed tarball with the same ESLint setup the scanner uses (inline eslint-disable comments are ignored).
// It also checks the `node` field of each codex file, which n8n verifies by hand.
// Run `npm run build` first. Set SCANNER_VERSION to pin a scanner version (defaults to latest).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');
const scannerVersion = process.env.SCANNER_VERSION || 'latest';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-community-package-'));
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
let failed = false;

try {
  if (!fs.existsSync(path.join(rootDir, 'dist'))) {
    throw new Error('dist/ not found, run `npm run build` first');
  }

  console.log(`Installing @n8n/scan-community-package@${scannerVersion}...`);
  const scannerDir = path.join(tempDir, 'scanner');
  fs.mkdirSync(scannerDir);
  // Install scripts are skipped: the scanner only needs them for a native module it never loads
  run('npm', ['install', '--no-save', '--no-package-lock', '--ignore-scripts', '--no-audit', '--no-fund', `@n8n/scan-community-package@${scannerVersion}`], scannerDir);
  const scannerPath = path.join(scannerDir, 'node_modules/@n8n/scan-community-package/dist/scanner.js');
  const { analyzePackage, SOURCE_FILE_PATTERNS } = await import(pathToFileURL(scannerPath).href);

  console.log('Packing the package...');
  run('npm', ['pack', '--pack-destination', tempDir], rootDir);
  const filename = fs.readdirSync(tempDir).find((file) => file.endsWith('.tgz'));
  const packageDir = path.join(tempDir, 'package');
  fs.mkdirSync(packageDir);
  run('tar', ['-xzf', path.join(tempDir, filename), '-C', packageDir, '--strip-components=1']);

  // Same two passes as the scanner: the source, and the compiled files that get published
  for (const [label, dir, patterns] of [
    ['source', rootDir, SOURCE_FILE_PATTERNS],
    ['tarball', packageDir, ['**/*.js', 'package.json']],
  ]) {
    const result = await analyzePackage(dir, patterns);
    if (result.passed) {
      console.log(`✅ Lint passed for the ${label}`);
    } else {
      failed = true;
      console.log(`❌ Lint failed for the ${label}: ${result.message}`);
      if (result.details) console.log(result.details);
    }
  }

  // The codex `node` field must be <package name>.<node name>
  const require = createRequire(import.meta.url);
  for (const nodePath of packageJson.n8n.nodes) {
    const nodeModule = require(path.join(rootDir, nodePath));
    const NodeClass = Object.values(nodeModule)[0];
    const codexPath = path.join(rootDir, nodePath.replace(/\.js$/, '.json'));
    const expected = `${packageJson.name}.${new NodeClass().description.name}`;
    const actual = fs.existsSync(codexPath) ? JSON.parse(fs.readFileSync(codexPath, 'utf8')).node : undefined;
    if (actual === expected) {
      console.log(`✅ Codex node field is correct in ${path.relative(rootDir, codexPath)}`);
    } else {
      failed = true;
      console.log(`❌ Codex node field in ${path.relative(rootDir, codexPath)} is ${JSON.stringify(actual)}, expected "${expected}"`);
    }
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

process.exitCode = failed ? 1 : 0;
