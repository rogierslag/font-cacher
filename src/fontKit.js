const fetch = require("node-fetch");
const log = require("./log");
const respondWithCache = require("./respondWithCache");
const parseNumberOrDefault = require("./numberParser");

const MAX_FONT_ENTRIES = parseNumberOrDefault(
  process.env.MAX_FONT_ENTRIES,
  250
);
const { getFromCache, addToCache, stats } = require("./cache")(
  "fontKit",
  MAX_FONT_ENTRIES
);

const FONT_CACHE_CONTROL = process.env.FONT_CACHE_CONTROL || null;
if (FONT_CACHE_CONTROL) {
  log(
    "info",
    `Using a cache-control response for font kit of '${FONT_CACHE_CONTROL}'`
  );
}

if (process.env.LOG_STATS) {
  setInterval(() => console.log("font", stats()), 6 * 60 * 60 * 1000);
}

const fontKit = async function font(ctx, retryCount = 0) {
  // Note this includes the search params
  const cacheKey = `${ctx.path.replace("/fontKit/", "")}${ctx.search}`;

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
  const forwardUrl = `https://fonts.gstatic.com/l/${cacheKey}`;
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
      await fontKit(ctx, retryCount + 1);
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
fontKit.stats = function statistics(ctx, serviceId) {
  ctx.body = Object.assign({}, stats(), { serviceId });
};

module.exports = fontKit;
