const Koa = require("koa");
const router = require("koa-route");
const Consul = require("consul");
const uuid = require("uuid");

const css = require("./css");
const font = require("./font");
const fontKit = require("./fontKit");
const log = require("./log");

let shuttingDown = false;
let serverInstance;

const server = new Koa();

const consulServiceId = uuid.v4();
const consulHost = process.env.CONSUL_HOST;
const consulClient = consulHost ? new Consul({ host: consulHost }) : null;
const serviceHost = process.env.SERVICE_HOST;
const port = Number(process.env.PORT) ? Number(process.env.PORT) : 3000;

const ONE_MEGABYTE = 1024 * 1024;

server.use(
  router.get(
    "/_health",
    (ctx) =>
      (ctx.body = { state: "HEALTHY", message: "I'm styley and I know it" }),
  ),
);
server.use(router.get("/css", (ctx) => css(ctx)));
server.use(router.get("/css2", (ctx) => css(ctx)));
server.use(router.get("/font/(.*)", (ctx) => font(ctx)));
server.use(router.get("/fontKit/(.*)", (ctx) => fontKit(ctx)));
server.use(router.get("/_stats/css", (ctx) => css.stats(ctx, consulServiceId)));
server.use(
  router.get("/_stats/font", (ctx) => font.stats(ctx, consulServiceId)),
);
server.use(
  router.get("/_stats/fontKit", (ctx) => fontKit.stats(ctx, consulServiceId)),
);
server.use(
  router.get("/_stats/memory", (ctx) => {
    const memory = process.memoryUsage();
    const mbMemory = Object.entries(memory)
      .map((e) => ({ key: e[0], value: e[1] }))
      .reduce((prev, next) => {
        // Round to 1 digit
        prev[next.key] = Math.round((next.value * 100) / ONE_MEGABYTE) / 100;
        return prev;
      }, {});
    ctx.body = {
      serviceId: consulServiceId,
      bytes: memory,
      megabytes: mbMemory,
    };
  }),
);

const onReady = async () => {
  if (consulClient) {
    try {
      await consulClient.agent.service.register({
        name: "font-cacher",
        id: consulServiceId,
        address: serviceHost,
        port,
        check: {
          http: `http://${serviceHost}:${port}/_health`,
          interval: "10s",
        },
      });
      log(
        "info",
        `Successfully registered with consul as '${consulServiceId}'`,
      );
    } catch (err) {
      log("error", `Could not register with consul. Error was ${err}.`);
      process.exit(1);
    }
  }

  log("info", "Server is ready");
};

const closeServer = () => {
  serverInstance.close(() => {
    log("info", "Server has shut down");
    process.exit();
  });
  const timeout = setTimeout(() => {
    log(
      "error",
      "Could not shutdown the server within 5 seconds. Force closing it!",
    );
    process.exit();
  }, 5 * 1000);
  timeout.unref();
};

const shutdown = async () => {
  if (shuttingDown) {
    log("info", "Already shutting down");
    return;
  }
  shuttingDown = true;
  log("info", "Starting the shutdown process");

  if (consulClient) {
    try {
      await consulClient.agent.service.deregister({ id: consulServiceId });
      log(
        "info",
        `Successfully deregistered from consul as '${consulServiceId}'`,
      );
    } catch (err) {
      log("error", `Could not deregister with consul. Error was ${err}.`);
    }
  }
  closeServer();
};

function handleError(errorType, withShutdown = false) {
  return (err) => {
    err.customReason = "uncaughtException";
    err.datetime = new Date();
    log("error", JSON.stringify(err));
    if (withShutdown) {
      shutdown();
    }
  };
}

process.on("uncaughtException", handleError("uncaughtException", true));
process.on("unhandledRejection", handleError("unhandledRejection", true));
process.on("warning", handleError("warning"));
process.on("message", handleError("message"));

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGQUIT", shutdown);
process.on("SIGABRT", shutdown);

serverInstance = server.listen(port, onReady);
