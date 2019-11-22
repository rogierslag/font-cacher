const DAYS_IN_YEAR = 365;
const SECONDS_IN_DAY = 86400;
export function oneYearInTheFuture() {
	const now = new Date() - 0;
	return new Date(now + DAYS_IN_YEAR * SECONDS_IN_DAY * 1000).toGMTString();
}
