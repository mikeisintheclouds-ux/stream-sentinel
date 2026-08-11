/**
 * Vendor-specific RTSP URL builders for dual-stream setups.
 * Main stream = high-res recording; sub stream = low-res live/detect.
 */

import type { CameraConfig, StreamEndpoints, Vendor } from "./types.js";

const DEFAULT_PORT = 554;

function auth(user: string, pass: string): string {
  return `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`;
}

function base(host: string, port: number, user: string, pass: string): string {
  return `rtsp://${auth(user, pass)}@${host}:${port}`;
}

/**
 * Lorex / Dahua-style channel paths
 * Channel N main: /Streaming/Channels/{N}01
 * Channel N sub:  /Streaming/Channels/{N}02
 */
function lorexUrls(c: CameraConfig): StreamEndpoints {
  const port = c.port ?? DEFAULT_PORT;
  const ch = c.channel ?? 1;
  const root = base(c.host, port, c.username, c.password);
  return {
    main: `${root}/Streaming/Channels/${ch}01`,
    sub: `${root}/Streaming/Channels/${ch}02`,
  };
}

/**
 * Reolink Preview paths
 * Main: /Preview_{ch}_main
 * Sub:  /Preview_{ch}_sub
 */
function reolinkUrls(c: CameraConfig): StreamEndpoints {
  const port = c.port ?? DEFAULT_PORT;
  const ch = String(c.channel ?? 1).padStart(2, "0");
  const root = base(c.host, port, c.username, c.password);
  return {
    main: `${root}/Preview_${ch}_main`,
    sub: `${root}/Preview_${ch}_sub`,
  };
}

/**
 * Generic / ONVIF-style (Media Profile tokens vary; these are common defaults)
 */
function genericUrls(c: CameraConfig): StreamEndpoints {
  const port = c.port ?? DEFAULT_PORT;
  const root = base(c.host, port, c.username, c.password);
  return {
    main: `${root}/stream1`,
    sub: `${root}/stream2`,
  };
}

const builders: Record<Vendor, (c: CameraConfig) => StreamEndpoints> = {
  lorex: lorexUrls,
  reolink: reolinkUrls,
  onvif: genericUrls,
  generic: genericUrls,
};

export function buildStreamUrls(camera: CameraConfig): StreamEndpoints {
  const builder = builders[camera.vendor] ?? genericUrls;
  return builder(camera);
}

/**
 * Redact credentials for safe logging / reports
 */
export function redactUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@");
}
