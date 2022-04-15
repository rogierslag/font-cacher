const dates = require("./dates");

module.exports = function respondWithCache(ctx, cached) {
  Object.entries(cached.headers).forEach((e) => ctx.set(e[0], e[1]));
  ctx.set("Expires", dates.oneYearInTheFuture());
  // Setting the status explicitly is required as the body is just piped
  ctx.status = 200;

  ctx.body = cached.body;
};
