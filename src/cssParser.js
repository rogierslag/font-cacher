function newCssItem() {
	return {
		key : null,
		fontFamily : null,
		fontStyle : null,
		fontWeight : null,
		fontDisplay : null,
		remoteSrc : null,
	};
}

function extractCssValue(line, prop) {
	return line.replace(`${prop}:`, '')
		.replace(/'/g, '')
		.replace(/;/g, '')
		.trim();
}

function unicodeRange(from, to) {
	return {from, to};
}

// Idiotically simple CSS parser, which just works for Google fonts
module.exports = function parseCss(css) {
	const lines = css.split('\n').map(e => e.trim());
	const result = [];
	let current = newCssItem();
	for (i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.startsWith('/* ') && line.endsWith('*/')) {
			// We just found the key!
			current.key = line.replace('/*', '')
				.replace('*/', '')
				.trim();
			continue;
		}
		if (line.startsWith('@font-face {')) {
			// don't care
			continue;
		}
		if (line.includes('font-family:')) {
			current.fontFamily = extractCssValue(line, 'font-family');
			continue;
		}
		if (line.includes('font-style:')) {
			current.fontStyle = extractCssValue(line, 'font-style');
			continue;
		}
		if (line.includes('font-weight:')) {
			current.fontWeight = extractCssValue(line, 'font-weight');
			continue;
		}
		if (line.includes('font-display:')) {
			current.fontDisplay = extractCssValue(line, 'font-display');
			continue;
		}
		if (line.includes('unicode-range:')) {
			current.unicodeRanges = extractCssValue(line, 'unicode-range')
				.split(',')
				.map(e => e.replace('U+', ''))
				.map(e => e.trim())
				// Convert everything to a range
				.map(item => {
					if (!item.includes('?') && !item.includes('-')) {
						// Single character
						return unicodeRange(item, item);
					} else if (item.includes('-')) {
						// Range
						const splitted = item.split('-');
						return unicodeRange(splitted[0], splitted[1]);
					} else {
						// Wildcard
						const wildcardCount = (item.match(/\?/g) || []).length;
						const prefix = item.split('?')[0];
						const from = `${prefix}${'0'.repeat(wildcardCount)}`;
						const to = `${prefix}${'9'.repeat(wildcardCount)}`;
						return unicodeRange(from, to);
					}
				});
			continue;
		}
		if (line.includes('src:')) {
			current.remoteSrc = line.replace(`src:`, '')
				.trim()
				.split('url(')[1]
				.split(')')[0];
			continue;
		}
		if (line === '}') {
			// don't care, but start a new item
			result.push(current);
			current = newCssItem();
			continue;
		}
	}
	return result;
};
