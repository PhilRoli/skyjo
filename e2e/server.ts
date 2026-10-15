import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export interface RunningServer {
  url: string;
  stop: () => Promise<void>;
}

/** Starts the real server (bun server/index.ts) as a child process. */
export async function startServer(port: number, dataDir: string): Promise<RunningServer> {
  const child: ChildProcess = spawn('bun', ['server/index.ts'], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, BOT_DELAY_MS: '10' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 10_000);
    child.stdout!.on('data', (d: Buffer) => {
      if (d.toString().includes('listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
  });
  return {
    url: `http://localhost:${port}`,
    stop: () =>
      new Promise<void>((resolve) => {
        child.removeAllListeners('exit');
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
      }),
  };
}

export const tempDataDir = () => path.join(mkdtempSync(path.join(tmpdir(), 'skyjo-e2e-')), 'data');
