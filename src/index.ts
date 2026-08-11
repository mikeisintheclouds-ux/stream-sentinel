/**
 * Stream Sentinel — public API
 */

export type {
  Vendor,
  StreamEndpoints,
  CameraConfig,
  HealthResult,
  StreamProbe,
  FleetReport,
  GenerateOptions,
} from "./types.js";

export { buildStreamUrls, redactUrl } from "./urls.js";
export { probeStream, tcpProbe, ffprobeStream } from "./probe.js";
export { checkCamera, checkFleet } from "./fleet.js";
export {
  generate,
  generateGo2rtc,
  generateFrigate,
  generateMediaMTX,
  generateJson,
} from "./generate.js";
