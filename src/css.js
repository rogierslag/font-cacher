const fetch = require('node-fetch');
const parser = require('ua-parser-js');
const log = require('./log');
const parseNumberOrDefault = require('./numberParser');
const parseCss = require('./cssParser');

const PUBLIC_URL = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/font`;
const MAX_CSS_ENTRIES = parseNumberOrDefault(process.env.MAX_CSS_ENTRIES, 500);

const {getFromCache, addToCache, stats} = require('./cache')('css', MAX_CSS_ENTRIES);

const CSS_CACHE_CONTROL = process.env.CSS_CACHE_CONTROL || null;
if (CSS_CACHE_CONTROL) {
	log('info', `Using a cache-control response for CSS of '${CSS_CACHE_CONTROL}'`);
}

if (process.env.LOG_STATS) {
	// Log every six hours
	setInterval(() => console.log('css', stats()), 6 * 60 * 60 * 1000);
}

function ninetyDaysInTheFuture() {
	const now = new Date() - 0;
	return new Date(now + 90 * 86400000).toGMTString();
}

function respondWithCache(ctx, cached) {
	Object.entries(cached.headers).forEach(e => ctx.set(e[0], e[1]));
	ctx.set('Expires', ninetyDaysInTheFuture());
	ctx.body = cached.body;
}

function key(querystring, userAgent) {
	if (!userAgent) {
		// We have no clue who we are talking to, so we let Google handle this
		return null;
	}
	try {
		const ua = parser(userAgent);
		if (!ua.browser || !ua.browser.name) {
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

function safeParsedCss(css) {
	try {
		return parseCss(css);
	} catch(e) {
		log('error', `Could not parse incoming CSS due to ${e.toString()}`);
		return [];
	}
}

const css = async function css(ctx, retryCount = 0) {
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
	try {
		const result = await fetch(forwardUrl, {
			method : 'get',
			headers
		});
		const originalCss = await result.text();

		// Redirect the actual font files to ourselves
		const bodyToCache = originalCss.replace(/https:\/\/fonts\.gstatic\.com\/s/g, PUBLIC_URL);

		const parsedCss = safeParsedCss(bodyToCache);
		// Get the subset to push, but always add latin. `null` is for IE support
		const requestedSubsets = [null, ctx.query.subset, 'latin'];
		const links = parsedCss.filter(i => requestedSubsets.includes(i.key))
			.map(i => i.remoteSrc)
			.filter(i => i)
			.map(url => new URL(url).pathname)
			.map(path => `<${path}>; as=font; rel=preload`)
			.join(', ');

		const headersToCache = {
			'Content-Type' : result.headers.get('content-type'),
			'Cache-Control' : CSS_CACHE_CONTROL || result.headers.get('cache-control'),
			'Date' : result.headers.get('date'),
			'timing-allow-origin' : '*',
			'access-control-allow-origin' : '*',
			'Status' : '200',
			'Link' : links,
		};
		if (result.headers.get('last-modified')) {
			// This is not always provided from upstream
			headersToCache['Last-Modified'] = result.headers.get('last-modified');
		}

		respondWithCache(ctx, addToCache(cacheKey, headersToCache, bodyToCache));
	} catch (e) {
		if (retryCount < 3) {
			log('warn', `Error occurred when fetching CSS data upstream. Will retry. ${e.toString()}`);
			await new Promise(resolve => setTimeout(resolve, 10));
			await css(ctx, retryCount + 1);
			return;
		}
		log('error', `Error occurred when fetching CSS data upstream: ${e.toString()}`);
		ctx.status = 503;
		ctx.body = 'Upstream service failure';
	}
};
css.stats = function statistics(ctx, serviceId) {
	ctx.body = Object.assign({}, stats(), {serviceId});
};

module.exports = css;
