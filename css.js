const fetch = require('node-fetch');

const PUBLIC_URL = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/font`;
const MAX_CSS_ENTRIES = process.env.MAX_CSS_ENTRIES || 10000;

const {getFromCache, addToCache} = require('./cache')('css', MAX_CSS_ENTRIES);

function respondWithCache(ctx, cached) {
	Object.entries(cached.headers).forEach(e => ctx.set(e[0], e[1]));
	ctx.status = 200;
	ctx.body = cached.body;
}

module.exports = async function css(ctx, log) {
	const cacheKey = ctx.querystring;

	const cached = getFromCache(cacheKey);
	if (cached) {
		// Cache hit, return and early terminate
		respondWithCache(ctx, cached);
		return;
	}

	const headers = {
		'user-agent' : ctx.header['user-agent'],
		'accept' : ctx.header['accept'],
		'accept-language' : ctx.header['accept-language'],
		'referer' : ctx.header['referer'],
	};
	const forwardUrl = `https://fonts.googleapis.com/css?${cacheKey}`;
	const result = await fetch(forwardUrl, {
		method : 'get',
		headers
	});
	const originalCss = await result.text();

	// Redirect the actual font files to ourselves
	const bodyToCache = originalCss.replace(/https:\/\/fonts\.gstatic\.com\/s/g, PUBLIC_URL);

	const headersToCache = {
		'Content-Type' : result.headers.get('content-type'),
		'Cache-Control' : result.headers.get('cache-control'),
		'Date' : result.headers.get('date'),
		'Expires' : result.headers.get('expires'),
		'Last-Modified' : result.headers.get('last-modified'),
		'timing-allow-origin' : '*',
		'access-control-allow-origin' : '*',
		'Status' : '200',
	};

	respondWithCache(ctx, addToCache(cacheKey, headersToCache, bodyToCache));
};
