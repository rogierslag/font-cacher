const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");

for (const failure of [null, "register", "deregister"]) {
  test(`Consul lifecycle: ${failure || "success"}`, async () => {
    const requests = [];
    const agent = http.createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      requests.push({ method: req.method, url: req.url, body });
      res.writeHead(req.url.includes(`/${failure}`) ? 500 : 200);
      res.end();
    });
    agent.listen(8500, "127.0.0.1");
    await once(agent, "listening");
    const child = spawn(process.execPath, ["src/index.js"], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        CONSUL_HOST: "127.0.0.1",
        SERVICE_HOST: "127.0.0.1",
        PORT: "19117",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    const exited = once(child, "exit");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10000);
    try {
      if (failure !== "register") {
        const deadline = Date.now() + 5000;
        while (
          !output.includes("Successfully registered") &&
          Date.now() < deadline
        ) {
          if (child.exitCode !== null) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.match(output, /Successfully registered/, output);
        child.kill("SIGTERM");
      }
      const [code, signal] = await exited;
      assert.equal(signal, null, output);
      assert.equal(code, failure === "register" ? 1 : 0, output);
      const registration = requests.find(
        (r) => r.url === "/v1/agent/service/register",
      );
      assert.ok(registration, output);
      assert.equal(registration.method, "PUT");
      const service = JSON.parse(registration.body);
      assert.equal(service.Name, "font-cacher");
      assert.equal(service.Port, 19117);
      if (failure !== "register") {
        assert.ok(
          requests.some(
            (r) => r.url === `/v1/agent/service/deregister/${service.ID}`,
          ),
        );
        assert.match(output, /Server has shut down/);
      }
      if (failure)
        assert.match(output, /Could not (register|deregister) with consul/);
    } finally {
      clearTimeout(timeout);
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
      await exited;
      agent.closeAllConnections();
      await new Promise((resolve) => agent.close(resolve));
    }
  });
}
