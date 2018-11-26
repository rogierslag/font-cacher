require('isomorphic-fetch');
const {ReReadable} = require("rereadable-stream");
const fetch = require('node-fetch');

const MAX_FONT_ENTRIES = process.env.MAX_FONT_ENTRIES || 1000;
const {getFromCache, addToCache} = require('./cache')('font', MAX_FONT_ENTRIES);

function respondWithCache(ctx, cached) {
	Object.entries(cached.headers).forEach(e => ctx.set(e[0], e[1]));
	ctx.status = 200;

	ctx.body = ctx.res.pipe(cached.body.rewind());
}

module.exports = async function font(ctx) {
	const cacheKey = ctx.path.replace('/font/', '');

	const cached = getFromCache(cacheKey);
	if (cached) {
		// Cacht hit, hence early return
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
		'Age' : result.headers.get('age'),
		'Access-Control-Allow-Origin' : result.headers.get('Access-Control-Allow-Origin'),
		'Content-Type' : result.headers.get('content-type'),
		'Cache-Control' : result.headers.get('cache-control'),
		'Date' : result.headers.get('date'),
		'Expires' : result.headers.get('expires'),
		'Last-Modified' : result.headers.get('last-modified'),
		'timing-allow-origin' : result.headers.get('timing-allow-origin'),
		'x-content-type-options' : result.headers.get('x-content-type-options'),
	};

	// Ensure we can re-read the stream at any point in time
	const rereadable = result.body.pipe(new ReReadable());
	respondWithCache(ctx, addToCache(cacheKey, responseHeaders, rereadable));
};
