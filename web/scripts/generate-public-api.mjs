import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

// Generate from the checked-in public specification, without starting the
// service stack or contacting private Pro Swagger endpoints.
const specification = await readFile(
  new URL('../../backend/docs/swagger.json', import.meta.url),
);
const server = createServer((request, response) => {
  if (request.url !== '/swagger/doc.json') {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(specification);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;
try {
  for (const application of ['panda-wiki-admin', 'panda-wiki-app']) {
    await new Promise((resolve, reject) => {
      const child = spawn('pnpm', ['--filter', application, 'api'], {
        stdio: 'inherit',
        env: { ...process.env, SWAGGER_BASE_URL: baseURL },
      });
      child.once('error', reject);
      child.once('exit', code =>
        code === 0
          ? resolve()
          : reject(new Error(`${application} API generation failed (${code})`)),
      );
    });
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
