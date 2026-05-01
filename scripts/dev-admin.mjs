import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const adminDir = resolve(rootDir, 'apps/admin');
const require = createRequire(import.meta.url);
const vitePackageDir = dirname(require.resolve('vite/package.json'));
const viteBin = resolve(vitePackageDir, 'bin/vite.js');
const localServiceUrl = 'http://127.0.0.1:8787/health';
const children = [];
let shuttingDown = false;

async function hasRunningLocalService() {
  try {
    const response = await fetch(localServiceUrl);
    return response.ok;
  } catch {
    return false;
  }
}

function spawnChild(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    const exitCode = signal ? 1 : code ?? 0;
    shutdown(exitCode);
  });

  child.on('error', () => {
    if (shuttingDown) return;
    shutdown(1);
  });

  console.log(`[admin:dev] started ${name}`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }

  setTimeout(() => process.exit(code), 80);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (!(await hasRunningLocalService())) {
  spawnChild('local-service', process.execPath, ['server/server.js'], adminDir);
} else {
  console.log('[admin:dev] reusing local admin service on http://127.0.0.1:8787');
}

spawnChild(
  'vite',
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', '5174'],
  adminDir,
);
