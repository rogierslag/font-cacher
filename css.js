const fetch = require('node-fetch');
const parser = require('ua-parser-js');
const log = require('./log');

const PUBLIC_URL = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/font`;
const MAX_CSS_ENTRIES = process.env.MAX_CSS_ENTRIES || 10000;

const {getFromCache, addToCache, stats} = require('./cache')('css', MAX_CSS_ENTRIES);

if (process.env.LOG_STATS) {
	// Log every six hours
	setInterval(() => console.log('css', stats()), 6 * 60 * 60 * 1000);
}

function respondWithCache(ctx, cached) {
	Object.entries(cached.headers).forEach(e => ctx.set(e[0], e[1]));
	ctx.body = cached.body;
}

function key(querystring, userAgent) {
	try {
		const ua = parser(userAgent);
		if (!ua.browser) {
			// Seems as a programmatic approach, so do not touch this and forward to Google
			return null;
		}
		const isMobile = ua.device && ua.device.type === 'mobile';
		const browser = ua.browser.name.toLowerCase();
		const version = ua.browser.major;
		return `${querystring}|${browser}${isMobile ? '-mobile' : ''}|${version}`;
	} catch (e) {
		log('error', `Could not determine cache key for q=${querystring}; ua=${userAgent}. Got ${e}`);
		return null;
	}
}
const css = async function css(ctx, log) {
	const cacheKey = key(ctx.querystring, ctx.req.headers['user-agent']);

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
	const forwardUrl = `https://fonts.googleapis.com/css?${ctx.querystring}`;
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
		'timing-allow-origin' : '*',
		'access-control-allow-origin' : '*',
		'Status' : '200',
	};
	if (result.headers.get('last-modified')) {
		// This is not always provided from upstream
		headersToCache['Last-Modified'] = result.headers.get('last-modified');
	}

	respondWithCache(ctx, addToCache(cacheKey, headersToCache, bodyToCache));
};
css.stats = function statistics(ctx, serviceId) {
	ctx.body = Object.assign({}, stats(), serviceId);
};

module.exports = css;
