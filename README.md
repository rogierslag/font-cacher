# Font cacher

With the advancements of HTTP2 it can be beneficial to route all assets, including fonts, through ones own domain.
This saves additional round trips to establish new connections to the font hosting.
Additionally it allows to initiate a HTTP2 server push directly, reducing the time for all critical CSS to be received by the browser.

This project aims to include just that, by allowing to an internal service which simply proxies (and caches) [Google Fonts](https://fonts.google.com/).

## Features

- Exact Google Fonts proxy: Only need to change the domain name in your application
- HTTP2 Push: Directly push the requested font files as part of the stream to further reduce latency
- Configurable cache size: Determine the number of CSS files and font files saved in the cache
- Memory friendly: We have seen cases where with a cache hit ratio of 95%+, only 50MB per instance is required.
- Cloud-friendly: Use [Consul](https://www.consul.io/) to register your instances
- HTTP API: Request memory usage and cache statistics through a HTTP JSON API.
 
## Configuration

The system is configured using environment variables.

| Key | Description |
|---|---|
| `MAX_CSS_ENTRIES` | The maximum number of CSS entries to cache. _Default 10000._ |
| `MAX_FONT_ENTRIES` | The maximum number of font entries to cache. _Default 1000._ The same number is used for font kits |
| `CSS_CACHE_CONTROL` | The value of the `Cache-control` header for all CSS responses. If not set, the upstream value will be used. |
| `FONT_CACHE_CONTROL` | The value of the `Cache-control` header for all font responses. If not set, the upstream value will be used. The same value is used for font kits |
| `PUBLIC_URL` | Public URL of access the fonts. _Default `http://localhost:3000/font/`._ |

In the URL you can specify the exact same parameters as Google Fonts.
One additional feature is available: by specifying a query param `noPush` the linked font files will not be pushed to the client.

You can request instance statistic from the following URLs:
- `_stats/css`: Cache statistics for the CSS cache
- `_stats/font`: Cache statistics for the font cache
- `_stats/fontKit`: Cache statistics for the font cache
- `_stats/memory`: Statistics about the instance memory usage

## Quick start

1. Start a Docker container `docker run -e PUBLIC_URL="https://yourdomain.com/fonts" -p 3000:3000 rogierslag/font-cacher`
1. Configure your application or load balancer to proxy its `/fonts` directory to the started Docker container.
1. Search for the following line `https://fonts.googleapis.com/css` and replace it with `https://yourdomain.com/fonts/css`. Leave the query string untouched.
1. Visit your application: the fonts will have gone through the proxy.

To further improve performance, you can set the following flag in [nginx](https://www.nginx.com/blog/nginx-1-13-9-http2-server-push/) to automatically push the resources as well `http2_push_preload on;`

## Blog

I blogged about this service on https://medium.com/@Rogier.Slag/nailing-ux-with-fast-font-delivery-446693db7a59?sk=d71b6138294620628826f04b141041ac

## CI

GitHub Actions runs separate formatting, JavaScript syntax, test, and Docker checks on pull requests and pushes to `master`. The checks can also be started manually. Node checks use the version in `.nvmrc`, install from the frozen Yarn lockfile, and cancel superseded runs on the same branch.

Tests cover CSS parsing and Consul registration/shutdown. Consul tests use the real client against a local HTTP stub; they do not contact production. The Docker check builds the production image and starts a temporary container to verify health and statistics endpoints without contacting Google Fonts or Consul. It does not publish an image.

Dependency review rejects pull requests that introduce dependencies with known moderate, high, or critical vulnerabilities. Dependabot proposes weekly npm, Docker, and GitHub Actions updates; minor and patch npm updates are grouped. Updates require review and are not merged automatically. CodeQL scanning and Dependabot security updates are already enabled in the repository settings.

Run `yarn install --frozen-lockfile` and `yarn run check` locally with the Node version in `.nvmrc`. The Consul tests require local ports 8500 and 19117 to be free. To verify the container locally, run `docker build --pull --tag font-cacher:ci .` followed by `bash scripts/docker-smoke.sh font-cacher:ci`.
