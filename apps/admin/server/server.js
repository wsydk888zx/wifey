import { createServer } from 'node:http';

const port = Number(process.env.PORT || 8787);

const server = createServer((_, res) => {
  const body = JSON.stringify({
    ok: true,
    message: 'Admin AI server scaffold. Migrate the root server.js endpoints here next.',
  });

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
});

server.listen(port, () => {
  console.log(`Admin scaffold server running at http://localhost:${port}`);
});
