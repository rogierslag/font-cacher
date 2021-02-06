const dates = require("./dates");

const fetch = require("node-fetch");
const log = require("./log");
const parseNumberOrDefault = require("./numberParser");

const MAX_FONT_ENTRIES = parseNumberOrDefault(
  process.env.MAX_FONT_ENTRIES,
  250
);
const { getFromCache, addToCache, stats } = require("./cache")(
  "font",
  MAX_FONT_ENTRIES
);

const FONT_CACHE_CONTROL = process.env.FONT_CACHE_CONTROL || null;
if (FONT_CACHE_CONTROL) {
  log(
    "info",
    `Using a cache-control response for fonts of '${FONT_CACHE_CONTROL}'`
  );
}

if (process.env.LOG_STATS) {
  setInterval(() => console.log("font", stats()), 6 * 60 * 60 * 1000);
}

function respondWithCache(ctx, cached) {
  Object.entries(cached.headers).forEach((e) => ctx.set(e[0], e[1]));
  ctx.set("Expires", dates.oneYearInTheFuture());
  // Setting the status explicitly is required as the body is just piped
  ctx.status = 200;

  ctx.body = cached.body;
}

const font = async function font(ctx, retryCount = 0) {
  const cacheKey = ctx.path.replace("/font/", "");

  const cached = getFromCache(cacheKey);
  if (cached) {
    // Cache hit, hence early return
    respondWithCache(ctx, cached);
    return;
  }

  const headers = {
    "user-agent": ctx.header["user-agent"],
    accept: ctx.header["accept"],
  };
  const forwardUrl = `https://fonts.gstatic.com/s/${cacheKey}`;
  try {
    const result = await fetch(forwardUrl, {
      method: "get",
      headers,
    });

    const responseHeaders = {
      "Access-Control-Allow-Origin": result.headers.get(
        "Access-Control-Allow-Origin"
      ),
      "Content-Type": result.headers.get("content-type"),
      "Cache-Control":
        FONT_CACHE_CONTROL || result.headers.get("cache-control"),
      Date: result.headers.get("date"),
      "Last-Modified": result.headers.get("last-modified"),
      "timing-allow-origin": result.headers.get("timing-allow-origin"),
      "x-content-type-options": result.headers.get("x-content-type-options"),
    };

    // Buffer the binary data
    const buffer = await result.buffer();
    respondWithCache(ctx, addToCache(cacheKey, responseHeaders, buffer));
  } catch (e) {
    if (retryCount < 3) {
      log(
        "warn",
        `Error occurred when fetching font data upstream. Will retry. ${e.toString()}`
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      await font(ctx, retryCount + 1);
      return;
    }
    log(
      "error",
      `Error occurred when fetching font data upstream: ${e.toString()}`
    );
    ctx.status = 503;
    ctx.body = "Upstream service failure";
  }
};
font.stats = function statistics(ctx, serviceId) {
  ctx.body = Object.assign({}, stats(), { serviceId });
};

module.exports = font;
