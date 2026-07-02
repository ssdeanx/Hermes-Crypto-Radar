// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Log Rotation
// ═══════════════════════════════════════════════════════════════════════

import * as fs from 'node:fs';
import * as zlib from 'node:zlib';
import * as path from 'node:path';

export interface LogRotationOptions {
  maxSizeBytes: number;
  maxArchives: number;
}

const DEFAULT_OPTIONS: LogRotationOptions = {
  maxSizeBytes: 10 * 1024 * 1024,
  maxArchives: 5,
};

export function rotateLogFile(
  filePath: string,
  options?: Partial<LogRotationOptions>,
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size < opts.maxSizeBytes) return;
    for (let i = opts.maxArchives - 1; i >= 1; i--) {
      const src = `${filePath}.${i}.gz`;
      const dst = `${filePath}.${i + 1}.gz`;
      if (fs.existsSync(src)) fs.renameSync(src, dst);
    }
    const archive1 = `${filePath}.1.gz`;
    if (fs.existsSync(archive1)) {
      fs.renameSync(archive1, `${filePath}.2.gz`);
    }
    const content = fs.readFileSync(filePath);
    const compressed = zlib.gzipSync(content);
    fs.writeFileSync(archive1, compressed);
    fs.writeFileSync(filePath, '');
  } catch (err) {
    console.error(`[log-rotation] Failed to rotate ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function checkLogRotation(
  filePath: string,
  options?: Partial<LogRotationOptions>,
): void {
  rotateLogFile(filePath, options);
}
