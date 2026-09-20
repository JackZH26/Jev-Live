import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';
const compile = spawn(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.main.json'], { stdio: 'inherit' });
compile.on('exit', async code => {
  if (code) process.exit(code);
  const server = await createServer(); await server.listen();
  const env = { ...process.env, JEV_DEV_URL: 'http://127.0.0.1:5173' }; delete env.ELECTRON_RUN_AS_NODE;
  const app = spawn(electron, ['.'], { stdio: 'inherit', env });
  app.on('exit', async code => { await server.close(); process.exit(code ?? 0); });
});
