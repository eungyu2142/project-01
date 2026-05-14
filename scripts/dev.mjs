import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const viteBin = path.resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const ansiPattern = /\u001B\[[0-9;]*m/g;
const urlPattern = /https?:\/\/(?:localhost|127\.0\.0\.1|\[[^\]]+\]|[0-9.]+):\d+(?:\/[^\s]*)?/i;

let hasOpenedBrowser = false;
let bufferedStdout = '';

function stripAnsi(value) {
  return value.replace(ansiPattern, '');
}

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromeCommand() {
  if (process.platform === 'win32') {
    const candidates = [
      process.env['PROGRAMFILES'],
      process.env['PROGRAMFILES(X86)'],
      process.env.LOCALAPPDATA,
    ]
      .filter(Boolean)
      .map((baseDir) => path.join(baseDir, 'Google', 'Chrome', 'Application', 'chrome.exe'));

    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        return { command: candidate, args: [] };
      }
    }

    return null;
  }

  if (process.platform === 'darwin') {
    return { command: 'open', args: ['-a', 'Google Chrome'] };
  }

  return { command: 'google-chrome', args: [] };
}

function openDefaultBrowser(url) {
  if (process.platform === 'win32') {
    const browser = spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    browser.unref();
    return;
  }

  const browser = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
    detached: true,
    stdio: 'ignore',
  });
  browser.unref();
}

async function openChrome(url) {
  const chrome = await resolveChromeCommand();

  if (!chrome) {
    openDefaultBrowser(url);
    return;
  }

  const browser = spawn(chrome.command, [...chrome.args, url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  browser.on('error', () => openDefaultBrowser(url));
  browser.unref();
}

async function maybeOpenChrome(chunk) {
  if (hasOpenedBrowser) {
    return;
  }

  bufferedStdout += stripAnsi(chunk.toString());
  const match = bufferedStdout.match(urlPattern);

  if (!match) {
    return;
  }

  hasOpenedBrowser = true;
  await openChrome(match[0]);
}

const originalStdoutWrite = process.stdout.write.bind(process.stdout);

process.stdout.write = (chunk, encoding, callback) => {
  const result = originalStdoutWrite(chunk, encoding, callback);
  void maybeOpenChrome(chunk);
  return result;
};

process.argv = [process.execPath, viteBin, ...process.argv.slice(2)];
await import(pathToFileURL(viteBin).href);
