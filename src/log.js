module.exports = function log(level, message) {
	console.log(JSON.stringify({level, message, datetime : (new Date()).toISOString()}));
};
