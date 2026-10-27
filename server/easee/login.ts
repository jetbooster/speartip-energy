// One-off bootstrap: trades your Easee username/password for tokens and caches the tokens.
// Usage: bun server/easee/login.ts <email>
import { loginWithPassword, TOKEN_FILE } from './auth';

const readPassword = (prompt: string) => new Promise<string>((resolve) => {
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');

  let password = '';
  const onData = (chunk: string) => {
    for (const char of chunk) {
      if (char === '\r' || char === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(password);
        return;
      }
      if (char === '\u0003') {
        process.exit(130);
      }
      if (char === '\u007f') {
        password = password.slice(0, -1);
      }
      else {
        password += char;
      }
    }
  };
  process.stdin.on('data', onData);
  process.stdin.resume();
});

const [userName] = process.argv.slice(2);
if (!userName) {
  console.error('Usage: bun server/easee/login.ts <email>');
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error('Run this in an interactive terminal so the password is not echoed or logged.');
  process.exit(1);
}

const password = await readPassword('Easee password: ');
await loginWithPassword(userName, password);
console.log(`Easee tokens cached at ${TOKEN_FILE}`);
