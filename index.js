const Koa = require('koa');
const router = require('koa-route');

const css = require('./css');
const font = require('./font');

let shuttingDown = false;
let serverInstance;
const server = new Koa();

const log = (level, message) => {
	console.log(JSON.stringify({level, message, datetime : (new Date()).toISOString()}));
};
const rootDir = `${__dirname}/example`;
const port = Number(process.env.PORT) ? Number(process.env.PORT) : 3000;

server.use(router.get('/_health', ctx => ctx.body = {state : 'HEALTHY', message : "Land ahoy!"}));
server.use(router.get('/css', ctx => css(ctx)));
server.use(router.get('/font/*', ctx => font(ctx)));

const onReady = () => {
	log('info', 'Server is ready');
};

const closeServer = () => {
	serverInstance.close(() => {
		log('info', 'Server has shut down');
		process.exit();
	});
};

const shutdown = () => {
	if (shuttingDown) {
		log('info', 'Already shutting down');
		return;
	}
	shuttingDown = true;
	log('info', 'Starting the shutdown process');

	closeServer();
};

process.on('uncaughtException', (err) => {
	log('error', JSON.stringify(err));
	shutdown();
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGQUIT', shutdown);
process.on('SIGABRT', shutdown);

serverInstance = server.listen(port, onReady);
