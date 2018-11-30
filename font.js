require('isomorphic-fetch');
const {ReReadable} = require("rereadable-stream");
const fetch = require('node-fetch');
const log = require('./log');

const MAX_FONT_ENTRIES = process.env.MAX_FONT_ENTRIES || 250;
const {getFromCache, addToCache, stats} = require('./cache')('font', MAX_FONT_ENTRIES);

if (process.env.LOG_STATS) {
	setInterval(() => console.log('font', stats()), 6 * 60 * 60 * 1000);
}

function respondWithCache(ctx, cached) {
	Object.entries(cached.headers).forEach(e => ctx.set(e[0], e[1]));
	ctx.set('Expires', ninetyDaysInTheFuture());
	// Setting the status explicitly is required as the body is just piped
	ctx.status = 200;

	ctx.body = ctx.res.pipe(cached.body.rewind());
}

function ninetyDaysInTheFuture() {
	const now = new Date() - 0;
	return new Date(now + 90 * 86400000).toGMTString();
}

const font = async function font(ctx) {
	const cacheKey = ctx.path.replace('/font/', '');

	const cached = getFromCache(cacheKey);
	if (cached) {
		// Cache hit, hence early return
		respondWithCache(ctx, cached);
		return;
	}

	const headers = {
		'user-agent' : ctx.header['user-agent'],
		'accept' : ctx.header['accept'],
	};
	const forwardUrl = `https://fonts.gstatic.com/s/${cacheKey}`;
	const result = await fetch(forwardUrl, {
		method : 'get',
		headers
	});

	const responseHeaders = {
		'Access-Control-Allow-Origin' : result.headers.get('Access-Control-Allow-Origin'),
		'Content-Type' : result.headers.get('content-type'),
		'Cache-Control' : result.headers.get('cache-control'),
		'Date' : result.headers.get('date'),
		'Last-Modified' : result.headers.get('last-modified'),
		'timing-allow-origin' : result.headers.get('timing-allow-origin'),
		'x-content-type-options' : result.headers.get('x-content-type-options'),
	};

	// Ensure we can re-read the stream at any point in time
	const rereadable = result.body.pipe(new ReReadable());
	respondWithCache(ctx, addToCache(cacheKey, responseHeaders, rereadable));
};
font.stats = function statistics(ctx, serviceId) {
	ctx.body = Object.assign({}, stats(), {serviceId});
};

module.exports = font;
