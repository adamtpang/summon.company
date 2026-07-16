import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const port = Number(process.env.VITALS_LIVE_UI_PORT ?? 3110);
const apiPort = Number(process.env.VITALS_MAIN_PORT ?? 3100);
const uiPort = Number(process.env.VITALS_DESIGN_PORT ?? 3102);

if (process.argv.includes("--daemon")) {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: process.env,
  });
  child.unref();
  process.stdout.write(`Vitals live UI proxy started (pid ${child.pid}) at http://${HOST}:${port}\n`);
  process.exit(0);
}

function targetPort(url = "") {
  return url.startsWith("/api") ? apiPort : uiPort;
}

function proxyHttp(request, response) {
  const upstreamPort = targetPort(request.url);
  const upstream = http.request(
    {
      hostname: HOST,
      port: upstreamPort,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: `${HOST}:${upstreamPort}` },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "upstream_unavailable", port: upstreamPort }));
  });
  request.pipe(upstream);
}

function proxyUpgrade(request, clientSocket, head) {
  const upstreamPort = targetPort(request.url);
  const upstreamSocket = net.connect(upstreamPort, HOST, () => {
    const headers = { ...request.headers, host: `${HOST}:${upstreamPort}` };
    const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`];
    for (const [name, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      lines.push(`${name}: ${Array.isArray(value) ? value.join(", ") : value}`);
    }
    upstreamSocket.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length > 0) upstreamSocket.write(head);
    clientSocket.pipe(upstreamSocket).pipe(clientSocket);
  });
  upstreamSocket.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upstreamSocket.destroy());
}

const server = http.createServer(proxyHttp);
server.on("upgrade", proxyUpgrade);
server.listen(port, HOST, () => {
  process.stdout.write(
    `Vitals live UI: http://${HOST}:${port} (UI ${uiPort}, control plane ${apiPort})\n`,
  );
});

