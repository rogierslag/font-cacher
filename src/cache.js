const log = require('./log');

const MAX_DATE = new Date(8640000000000000);

module.exports = function createCache(name, maxSize) {
	const started = new Date().toISOString();
	const cache = new Map();
	let hits = 0;
	let misses = 0;

	// Throws the least recently used item from the cache
	function trimCache(force = false) {
		const cacheUsage = cache.size / maxSize;
		if (!force && cacheUsage < 0.8) {
			// When we have more then enough space, do not try to trim the cache
			log('info', `No need for ${name} cache cleaning, as it is only used for ${Math.round(cacheUsage * 100)}%`);
			return;
		}

		let oldestDate = MAX_DATE;
		let oldestItem = null;
		// Not making copies to preserve memory
		cache.forEach((val, key) => {
			const lastUsedAt = val.last_used_at;
			if (lastUsedAt < oldestDate) {
				oldestDate = lastUsedAt;
				oldestItem = key;
			}
		});

		if (oldestItem) {
			log('info', `Will delete ${name} key ${oldestItem} (last used at: ${oldestDate.toISOString()})`);
			cache.delete(oldestItem);
		}
	}

	// Throws out all items over 7 days old
	function pruneCache() {
		log('info', `Starting cache pruning for ${name}`);
		const threshold = new Date() - 7 * 24 * 60 * 60 * 1000;
		// Not making copies to conserve memory
		cache.forEach((val, key) => {
			const addedAt = val.added_at;
			if (addedAt < threshold) {
				log('info', `Will delete ${name} key ${key} (added at: ${addedAt.toISOString()})`);
				cache.delete(key);
			}

		});
	}

	setInterval(pruneCache, 60 * 60 * 1000);

	function getFromCache(cacheKey) {
		if (cacheKey === null) {
			return null;
		}
		if (Math.random() < 0.001) {
			log('info', `${name} cache clean started`);
			trimCache();
		}
		const cachedValue = cache.get(cacheKey);
		if (cachedValue) {
			hits++;
			cachedValue.last_used_at = new Date();
		} else {
			misses++;
		}

		return cachedValue || null;
	}

	function addToCache(cacheKey, headers, body) {
		const cacheValue = {headers, body, last_used_at : new Date(), added_at : new Date()};
		if (cacheKey === null) {
			return cacheValue
		}
		cache.set(cacheKey, cacheValue);

		if (cache.size >= maxSize) {
			log('info', `${name} cache clean required`);
			trimCache();
		}
		log('info', `${name} cache contains ${cache.size} items`);

		// Always return the set item, even if it may have been removed immediately
		return cacheValue;
	}

	function stats() {
		return {
			hits,
			misses,
			size : cache.size,
			maxSize,
			started
		}
	}

	return {
		getFromCache,
		addToCache,
		stats
	}
};
