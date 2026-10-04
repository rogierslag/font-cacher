#!/usr/bin/env bash
set -euo pipefail

image="${1:-font-cacher:ci}"
container_id="$(docker run --detach "$image")"
cleanup() {
  docker logs "$container_id"
  docker rm --force "$container_id" >/dev/null
}
trap cleanup EXIT

# Probe inside the container without exposing a host port or contacting Google.
docker exec -i "$container_id" node <<'NODE'
const assert = require('node:assert/strict');

(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3000/_health', {
        signal: AbortSignal.timeout(1000),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).state, 'HEALTHY');
      ready = true;
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, 'Production container did not become healthy');

  for (const endpoint of ['css', 'font', 'fontKit', 'memory']) {
    const response = await fetch(`http://127.0.0.1:3000/_stats/${endpoint}`, {
      signal: AbortSignal.timeout(1000),
    });
    assert.equal(response.status, 200, endpoint);
    const body = await response.json();
    assert.ok(body.serviceId, endpoint);
  }
  console.log('Production health and statistics endpoints passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
NODE
