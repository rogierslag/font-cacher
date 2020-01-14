module.exports = function log(level, message) {
	const datetime = new Date().toISOString();
	console.log(JSON.stringify({level, datetime, message}));
};
