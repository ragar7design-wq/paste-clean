import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public', { recursive: true });
cpSync('src/css', 'public/css', { recursive: true });
cpSync('src/js', 'public/js', { recursive: true });
console.log('Build OK: static assets copied to public/');
