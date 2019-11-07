const fetch = require('node-fetch');

const FONTS = [
	'Roboto',
	'Heebo',
	'Fokdo',
	'Open Sans',
	'Late',
	'Montserrat',
	'Roboto condensed',
	'Source Sans Pro',
	'Raleway'
];

const FONT_WEIGHTS = [
	300,
	400,
	500,
	600,
	700,
];

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36';
const opts = {
	headers : {
		'User-Agent' : USER_AGENT,
	},
};

const MAX_REQUESTS = Number(process.env.MAX) || 100;
console.log(`Gonna run ${MAX_REQUESTS} tests on CSS cache`);

async function getNextRandomItem() {
	if (currentRequests >= MAX_REQUESTS) {
		console.log('Done!');
		return;
	}

	console.log(`Now at request ${currentRequests}`);

	const fontCount = Math.floor(Math.random() * (FONTS.length - 1)) + 1;
	const weightCount = Math.floor(Math.random() * (FONT_WEIGHTS.length * 2 - 1)) + 1;
	const fonts = [];
	const weights = [];
	for (let i = 0; i < fontCount; i++) {
		fonts.push(randomItemFromArray(FONTS));
	}
	for (let i = 0; i < weightCount; i++) {
		const italic = Math.random() > 0.5 ? 'i' : '';
		weights.push(randomItemFromArray(FONT_WEIGHTS) + italic);
	}

	const family = `${fonts.map(e => e.replace(/ /g, '+')).join('|')}:${weights.join(',')}`;
	console.log(`Now getting: ${family}`);

	const result = await fetch(`http://localhost:3000/css?family=${family}`, opts).then(response => response.text());

	const fontFiles = result.split('\n')
		.filter(e => e.includes('url('))
		.map(e => e.split('url(')[1])
		.map(e => e.split(')')[0]);
	console.log(`Getting an additional ${fontFiles.length} font files`);
	for (let i = 0; i < fontFiles.length; i++) {
		await fetch(fontFiles[i], opts);
	}
	currentRequests++;
	getNextRandomItem();
}

let currentRequests = 0;

function randomItemFromArray(array) {
	return array[Math.floor(Math.random() * array.length)];
}

getNextRandomItem();
