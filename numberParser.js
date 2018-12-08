function parseNumberOrDefault(toParse, defaultValue, shouldAllowOnlyPositive = true) {
	if (toParse === null || toParse === undefined || toParse === '') {
		return defaultValue;
	}

	const number = Number(toParse);
	if (isNaN(number)) {
		return defaultValue;
	}
	if (`${number}` !== toParse) {
		return defaultValue;
	}
	if (shouldAllowOnlyPositive && number < 0) {
		return defaultValue;
	}
	return number;
}

module.exports = parseNumberOrDefault;
