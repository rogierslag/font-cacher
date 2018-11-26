const MAX_DATE = new Date(8640000000000000);

module.exports = function createCache(name, maxSize) {
	const cache = new Map();

	function trimCache() {
		const itemToDelete = Array.from(cache.entries())
			.map(e => ({key : e[0], last_used_at : e[1].last_used_at}))
			.reduce((previousValue, currentValue) => {
				const isPreviousBeforeCurrent = currentValue.last_used_at - previousValue.last_used_at < 0;
				if (isPreviousBeforeCurrent) {
					return currentValue;
				}
				return previousValue;
			}, {last_used_at : MAX_DATE});
		console.log(`Will delete font key ${itemToDelete.key} (last used at: ${itemToDelete.last_used_at}`);
		cache.delete(itemToDelete.key);
	}

	function getFromCache(querystring) {
		if (Math.random() < 0.001) {
			console.log(`${name} cache clean started`);
			trimCache();
		}
		const cachedValue = cache.get(querystring);
		if (cachedValue) {
			cachedValue.last_used_at = new Date();
		}

		return cachedValue || null;
	}

	function addToCache(querystring, headers, body) {
		cache.set(querystring, {headers, body, last_used_at : new Date()});
		const result = cache.get(querystring);

		if (cache.size >= maxSize) {
			console.log(`${name} cache clean required`);
			trimCache();
		}
		console.log(`${name} cache contains ${cache.size} items`);

		return result;
	}

	return {
		getFromCache,
		addToCache
	}
};
