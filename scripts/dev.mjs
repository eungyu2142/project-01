import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const viteBin = path.resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');

process.argv = [process.execPath, viteBin, ...process.argv.slice(2)];
await import(pathToFileURL(viteBin).href);
