/**
 * Fleet-level health checks and aggregation.
 */

import type {
  CameraConfig,
  FleetReport,
  HealthResult,
} from "./types.js";
import { buildStreamUrls } from "./urls.js";
import { probeStream } from "./probe.js";

export async function checkCamera(
  camera: CameraConfig,
  options?: { preferFfprobe?: boolean; timeoutMs?: number }
): Promise<HealthResult> {
  const urls = buildStreamUrls(camera);
  const [main, sub] = await Promise.all([
    probeStream(urls.main, options),
    probeStream(urls.sub, options),
  ]);

  let overall: HealthResult["overall"] = "healthy";
  if (!main.reachable && !sub.reachable) overall = "down";
  else if (!main.reachable || !sub.reachable) overall = "degraded";

  return {
    cameraId: camera.id,
    name: camera.name,
    main,
    sub,
    overall,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Check an entire fleet with bounded concurrency.
 */
export async function checkFleet(
  cameras: CameraConfig[],
  options?: {
    concurrency?: number;
    preferFfprobe?: boolean;
    timeoutMs?: number;
  }
): Promise<FleetReport> {
  const concurrency = Math.max(1, options?.concurrency ?? 5);
  const results: HealthResult[] = [];
  let index = 0;

  async function worker() {
    while (index < cameras.length) {
      const i = index++;
      const result = await checkCamera(cameras[i], options);
      results[i] = result;
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, cameras.length) },
    () => worker()
  );
  await Promise.all(workers);

  const healthy = results.filter((r) => r.overall === "healthy").length;
  const degraded = results.filter((r) => r.overall === "degraded").length;
  const down = results.filter((r) => r.overall === "down").length;

  return {
    total: cameras.length,
    healthy,
    degraded,
    down,
    results,
    generatedAt: new Date().toISOString(),
  };
}
