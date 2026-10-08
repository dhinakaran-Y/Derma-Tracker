const { spawn } = require('child_process');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(name, args, cwd, colorCode) {
  const proc = spawn(npmCmd, args, {
    cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const prefix = `\x1b[${colorCode}m[${name}]\x1b[0m `;

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line, idx) => {
      if (idx === lines.length - 1 && line === '') return;
      process.stdout.write(`${prefix}${line}\n`);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line, idx) => {
      if (idx === lines.length - 1 && line === '') return;
      process.stderr.write(`${prefix}${line}\n`);
    });
  });

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${prefix}Process exited with code ${code}`);
    }
  });

  return proc;
}

console.log('\x1b[36m🚀 Starting DermaTrack Server & Client...\x1b[0m\n');

const server = run('SERVER', ['run', 'dev'], './server', '34'); // 34 = Blue
const client = run('CLIENT', ['run', 'dev'], './client', '35'); // 35 = Magenta

function shutdown() {
  console.log('\n\x1b[33m🛑 Shutting down DermaTrack services...\x1b[0m');
  try {
    server.kill('SIGINT');
  } catch {}
  try {
    client.kill('SIGINT');
  } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
