/**
 * Stream Sentinel — core types for dual-stream camera fleets
 */

export type Vendor = "lorex" | "reolink" | "onvif" | "generic";

export interface StreamEndpoints {
  main: string;
  sub: string;
}

export interface CameraConfig {
  id: string;
  name: string;
  vendor: Vendor;
  host: string;
  port?: number;
  username: string;
  password: string;
  /** Channel number (1-based) for multi-channel NVRs */
  channel?: number;
  site?: string;
  tags?: string[];
}

export interface HealthResult {
  cameraId: string;
  name: string;
  main: StreamProbe;
  sub: StreamProbe;
  overall: "healthy" | "degraded" | "down";
  checkedAt: string;
}

export interface StreamProbe {
  url: string;
  reachable: boolean;
  latencyMs?: number;
  error?: string;
  codec?: string;
  resolution?: string;
}

export interface FleetReport {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  results: HealthResult[];
  generatedAt: string;
}

export interface GenerateOptions {
  format: "go2rtc" | "frigate" | "mediamtx" | "json";
  detectOnSub?: boolean;
  recordOnMain?: boolean;
}
