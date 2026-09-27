import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Wurzelverzeichnis des Projekts (enthält package.json). */
export const PROJEKT_WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
