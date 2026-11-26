import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export const CLASSIFIER_OPTIONS = [
  '-p', '--output-format', 'json', '--tools', '', '--model', 'haiku',
  '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence',
];

export async function runClaude(prompt, execute = execFile) {
  const cwd = await mkdtemp(join(tmpdir(), 'lunch-classifier-'));
  try {
    let stdout;
    try {
      stdout = await new Promise((resolve, reject) => {
        const child = execute('claude', [...CLASSIFIER_OPTIONS, '--', prompt], {
          cwd, timeout: 120_000, killSignal: 'SIGKILL',
        }, (error, output) => {
          if (error) reject(error);
          else resolve(output);
        });
        child.stdin?.end();
      });
    } catch (error) {
      if (error.killed) throw new Error('Claude CLI 시간 초과');
      throw new Error(`Claude CLI 실행 실패 (${error.code ?? 'unknown'})`);
    }
    let response;
    try {
      response = JSON.parse(stdout);
    } catch {
      throw new Error('Claude CLI JSON 출력 오류');
    }
    if (response?.is_error || typeof response?.result !== 'string') {
      throw new Error('Claude CLI 결과 없음');
    }
    return response.result;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
