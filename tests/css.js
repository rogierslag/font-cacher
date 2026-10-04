const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const { test } = require("node:test");
const Koa = require("koa");
const router = require("koa-route");
const parseCss = require("../src/cssParser");

function assertLocalFontUrls(body) {
  const faces = parseCss(body);
  assert.ok(faces.length > 0, "stylesheet should contain font faces");
  for (const face of faces) {
    const url = new URL(face.remoteSrc);
    assert.equal(url.origin, "http://localhost:3000");
  }
}

test("CSS proxy endpoints and response caching", async (t) => {
  // The real cache starts a pruning timer; clean it up when this test ends.
  const originalSetInterval = global.setInterval;
  const timers = t.mock.method(global, "setInterval", (...args) => {
    const timer = originalSetInterval(...args);
    t.after(() => clearInterval(timer));
    return timer;
  });
  const css = require("../src/css");
  timers.mock.restore();

  const originalFetch = global.fetch;
  const fixture = fs.readFileSync(
    `${__dirname}/cssResources/simpleChromeWithSwapAndExtendedSubset.css`,
    "utf8",
  );
  const variableFixture = fs.readFileSync(
    `${__dirname}/cssResources/css2Variable.css`,
    "utf8",
  );
  const textFixture = fs.readFileSync(
    `${__dirname}/cssResources/css2Text.css`,
    "utf8",
  );
  const legacyFixture = fs.readFileSync(
    `${__dirname}/cssResources/css2Legacy.css`,
    "utf8",
  );
  const upstreamRequests = [];
  t.mock.method(global, "fetch", async (url, options) => {
    if (!String(url).startsWith("https://fonts.googleapis.com/")) {
      return originalFetch(url, options);
    }
    upstreamRequests.push({ url: String(url), headers: options.headers });
    const upstreamUrl = new URL(url);
    if (upstreamUrl.searchParams.has("invalid")) {
      return new Response("Invalid font request", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }
    const body =
      upstreamUrl.pathname === "/css2"
        ? upstreamUrl.searchParams.has("text")
          ? textFixture
          : options.headers["user-agent"]?.includes("Trident/")
            ? legacyFixture
            : variableFixture
        : fixture;
    return new Response(body, {
      headers: {
        "Content-Type": "text/css",
        "Cache-Control": "public, max-age=86400",
        Date: new Date().toUTCString(),
      },
    });
  });

  const app = new Koa();
  app.use(async (ctx, next) => {
    if (ctx.query.vary) ctx.set("Vary", ctx.query.vary);
    await next();
  });
  app.use(router.get("/css", (ctx) => css(ctx)));
  app.use(router.get("/css2", (ctx) => css(ctx)));
  const server = app.listen(0, "127.0.0.1");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}/css?family=Roboto`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  };

  await t.test("cache misses and hits include Vary", async () => {
    const miss = await originalFetch(baseUrl, { headers });
    assert.equal(miss.status, 200);
    assert.equal(miss.headers.get("vary"), "User-Agent");
    assert.match(miss.headers.get("content-type"), /^text\/css/);
    const body = await miss.text();
    const hit = await originalFetch(baseUrl, { headers });
    assert.equal(hit.headers.get("vary"), "User-Agent");
    assert.equal(await hit.text(), body);
    assert.equal(
      upstreamRequests.length,
      1,
      "second request should use the cache",
    );
    assert.equal(
      upstreamRequests[0].url,
      "https://fonts.googleapis.com/css?family=Roboto",
    );
  });

  for (const existing of ["Accept-Encoding", "User-Agent", "*"]) {
    await t.test(`preserves existing Vary: ${existing}`, async () => {
      const url = `${baseUrl}&vary=${encodeURIComponent(existing)}`;
      const expected =
        existing === "Accept-Encoding"
          ? "Accept-Encoding, User-Agent"
          : existing;
      for (let request = 0; request < 2; request++) {
        const response = await originalFetch(url, { headers });
        assert.equal(response.headers.get("vary"), expected);
        await response.text();
      }
    });
  }

  await t.test(
    "responses without a User-Agent still include Vary",
    async () => {
      const before = upstreamRequests.length;
      for (let request = 0; request < 2; request++) {
        const response = await originalFetch(baseUrl, {
          headers: { "User-Agent": "" },
        });
        assert.equal(response.headers.get("vary"), "User-Agent");
        await response.text();
      }
      assert.equal(
        upstreamRequests.length,
        before + 2,
        "requests should bypass cache",
      );
    },
  );

  const css2Url = baseUrl.replace("/css?", "/css2?");
  await t.test("CSS2 uses its own endpoint and cache", async () => {
    const before = upstreamRequests.length;
    const first = await originalFetch(css2Url, { headers });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("vary"), "User-Agent");
    const body = await first.text();
    assert.match(body, /font-weight: 200 900;/);
    assert.match(body, /font-style: italic;/);
    assert.match(body, /unicode-range:/);
    assertLocalFontUrls(body);
    assert.match(body, /http:\/\/localhost:3000\/font\/crimsonpro\//);
    assert.match(first.headers.get("link"), /\/font\/crimsonpro\//);
    const hit = await originalFetch(css2Url, { headers });
    assert.equal(hit.headers.get("vary"), "User-Agent");
    assert.equal(await hit.text(), body);
    assert.equal(upstreamRequests.length, before + 1);
    assert.equal(
      upstreamRequests.at(-1).url,
      "https://fonts.googleapis.com/css2?family=Roboto",
    );
  });

  await t.test(
    "CSS2 forwards repeated families and encoded text unchanged",
    async () => {
      const query =
        "family=Crimson+Pro:ital,wght@0,200..900;1,200..900&family=Literata&text=Hello%20%26%20world&display=swap";
      const url = `${css2Url.split("?")[0]}?${query}&noPush`;
      const response = await originalFetch(url, { headers });
      assert.equal(
        upstreamRequests.at(-1).url,
        `https://fonts.googleapis.com/css2?${query}&noPush`,
      );
      assert.equal(
        upstreamRequests.at(-1).headers["user-agent"],
        headers["User-Agent"],
      );
      const body = await response.text();
      assert.match(body, /http:\/\/localhost:3000\/fontKit\/font\?kit=/);
      assertLocalFontUrls(body);
      assert.equal(response.headers.get("link"), null);
    },
  );

  await t.test(
    "CSS2 distinguishes full user agents with the same browser version",
    async () => {
      const before = upstreamRequests.length;
      const otherHeaders = {
        "User-Agent": headers["User-Agent"].replace(
          "Windows NT 10.0",
          "Windows NT 6.1",
        ),
      };
      const response = await originalFetch(css2Url, { headers: otherHeaders });
      const body = await response.text();
      assert.ok(body.includes(otherHeaders["User-Agent"]));
      assert.equal(upstreamRequests.length, before + 1);
      const hit = await originalFetch(css2Url, { headers: otherHeaders });
      assert.equal(await hit.text(), body);
      assert.equal(upstreamRequests.length, before + 1);
    },
  );

  await t.test(
    "CSS2 preserves Google's static-font fallback for legacy browsers",
    async () => {
      const before = upstreamRequests.length;
      const userAgent =
        "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko";
      const response = await originalFetch(css2Url, {
        headers: { "User-Agent": userAgent },
      });
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("vary"), "User-Agent");
      assert.match(body, /font-weight: 200;/);
      assert.match(body, /font-weight: 900;/);
      assert.ok(!body.includes("font-weight: 200 900;"));
      assert.match(
        body,
        /http:\/\/localhost:3000\/font\/crimsonpro\/[^)]+\.woff\)/,
      );
      assertLocalFontUrls(body);
      assert.equal(upstreamRequests.length, before + 1);
      assert.equal(upstreamRequests.at(-1).headers["user-agent"], userAgent);
    },
  );

  await t.test(
    "upstream errors retain their status and are not cached",
    async () => {
      for (const url of [baseUrl, css2Url]) {
        const before = upstreamRequests.length;
        for (let request = 0; request < 2; request++) {
          const response = await originalFetch(`${url}&invalid`, { headers });
          assert.equal(response.status, 400);
          assert.equal(response.headers.get("cache-control"), "no-store");
          assert.equal(response.headers.get("vary"), "User-Agent");
          assert.equal(response.headers.get("link"), null);
          assert.equal(await response.text(), "Invalid font request");
        }
        assert.equal(upstreamRequests.length, before + 2);
      }
    },
  );
});
