const Koa = require('koa');
const router = require('koa-route');
const consul = require('consul');
const uuid = require('uuid');

const css = require('./css');
const font = require('./font');
const log = require('./log');

let shuttingDown = false;
let registeredToConsul = false;
let serverInstance;

const server = new Koa();

const consulServiceId = uuid.v4();
const consulHost = process.env.CONSUL_HOST ? process.env.CONSUL_HOST : "localhost";
const serviceHost = process.env.SERVICE_HOST ? process.env.SERVICE_HOST : "localdev.internal.magnet.me";
const port = Number(process.env.PORT) ? Number(process.env.PORT) : 3000;

server.use(router.get('/_health', ctx => ctx.body = {state : 'HEALTHY', message : "I'm styley and I know it"}));
server.use(router.get('/css', ctx => css(ctx)));
server.use(router.get('/font/*', ctx => font(ctx)));
server.use(router.get('/_stats/css', ctx => css.stats(ctx)));
server.use(router.get('/_stats/font', ctx => font.stats(ctx)));
server.use(router.get('/_stats/memory', ctx => {
	ctx.body = process.memoryUsage();
}));

const onReady = () => {
	// Register in Consul if required
	if (consulHost) {
		consul({host : consulHost}).agent.service.register({
			name : 'font-cacher',
			id : consulServiceId,
			address : serviceHost,
			port : port,
			check : {
				http : `http://${serviceHost}:${port}/_health`,
				interval : "10s"
			}
		}, err => {
			if (!err) {
				log('info', `Successfully registered with consul as '${consulServiceId}'`);
				registeredToConsul = true;
			} else {
				log('error', `Could not register with consul. Error was ${err}.`);
			}
		});
	}

	log('info', 'Server is ready');
};

const closeServer = () => {
	serverInstance.close(() => {
		log('info', 'Server has shut down');
		process.exit();
	});
	setTimeout(() => {
		log('error', 'Could not shutdown the server within 5 seconds. Force closing it!');
		process.exit();
	}, 5 * 1000);
};

const shutdown = () => {
	if (shuttingDown) {
		log('info', 'Already shutting down');
		return;
	}
	shuttingDown = true;
	log('info', 'Starting the shutdown process');

	if (registeredToConsul) {
		// IntelliJ does not allow the shutdown sequence to propagate, so deregistration does not fire
		consul({host : consulHost}).agent.service.deregister({
			id : consulServiceId
		}, err => {
			if (!err) {
				log('info', `Successfully deregistered from consul as '${consulServiceId}'`);
			} else {
				log('error', `Could not deregister with consul. Error was ${err}.`);
			}
			closeServer();
		});
	} else {
		closeServer();
	}
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
