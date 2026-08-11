/**
 * Stream health probing via ffprobe (preferred) or TCP connect fallback.
 */

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import type { StreamProbe } from "./types.js";
import { redactUrl } from "./urls.js";

const DEFAULT_TIMEOUT_MS = 8000;

function parseRtspHostPort(url: string): { host: string; port: number } | null {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 554,
    };
  } catch {
    return null;
  }
}

/**
 * Lightweight TCP reachability check (no media decode).
 */
export function tcpProbe(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<StreamProbe> {
  const target = parseRtspHostPort(url);
  if (!target) {
    return Promise.resolve({
      url: redactUrl(url),
      reachable: false,
      error: "Invalid RTSP URL",
    });
  }

  const start = Date.now();
  return new Promise((resolve) => {
    const socket = createConnection(
      { host: target.host, port: target.port },
      () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({
          url: redactUrl(url),
          reachable: true,
          latencyMs,
        });
      }
    );

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        url: redactUrl(url),
        reachable: false,
        error: `TCP timeout after ${timeoutMs}ms`,
      });
    });
    socket.on("error", (err) => {
      resolve({
        url: redactUrl(url),
        reachable: false,
        error: err.message,
      });
    });
  });
}

/**
 * Full media probe with ffprobe (codec, resolution, latency).
 * Falls back to TCP if ffprobe is missing or fails.
 */
export function ffprobeStream(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<StreamProbe> {
  return new Promise((resolve) => {
    const args = [
      "-v",
      "error",
      "-rtsp_transport",
      "tcp",
      "-i",
      url,
      "-show_entries",
      "stream=codec_name,width,height",
      "-of",
      "json",
      "-timeout",
      String(timeoutMs * 1000),
    ];

    const start = Date.now();
    const child = spawn("ffprobe", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        url: redactUrl(url),
        reachable: false,
        error: `ffprobe timeout after ${timeoutMs}ms`,
      });
    }, timeoutMs + 1000);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", async () => {
      clearTimeout(timer);
      resolve(await tcpProbe(url, timeoutMs));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (code !== 0) {
        resolve({
          url: redactUrl(url),
          reachable: false,
          latencyMs,
          error: stderr.trim().slice(0, 200) || `ffprobe exit ${code}`,
        });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const stream = data.streams?.[0] ?? {};
        resolve({
          url: redactUrl(url),
          reachable: true,
          latencyMs,
          codec: stream.codec_name,
          resolution:
            stream.width && stream.height
              ? `${stream.width}x${stream.height}`
              : undefined,
        });
      } catch {
        resolve({
          url: redactUrl(url),
          reachable: true,
          latencyMs,
        });
      }
    });
  });
}

export async function probeStream(
  url: string,
  options?: { preferFfprobe?: boolean; timeoutMs?: number }
): Promise<StreamProbe> {
  const prefer = options?.preferFfprobe !== false;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (prefer) {
    return ffprobeStream(url, timeoutMs);
  }
  return tcpProbe(url, timeoutMs);
}
