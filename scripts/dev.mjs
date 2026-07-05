import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 5173);
const API_PORT = PORT + 1;

const api = spawn('node', ['scripts/server.mjs'], {
  env: { ...process.env, PORT: API_PORT, INTERNAL_PORT: API_PORT },
  stdio: 'inherit'
});

const dev = spawn('node', ['scripts/dev-server.mjs'], {
  env: { ...process.env, PORT, API_PORT },
  stdio: 'inherit'
});

const stop = (sig) => {
  dev.kill(sig);
  api.kill(sig);
  process.exit(0);
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));