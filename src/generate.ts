/**
 * Config generators for go2rtc, Frigate, MediaMTX dual-stream pipelines.
 */

import { stringify as yamlStringify } from "yaml";
import type { CameraConfig, GenerateOptions } from "./types.js";
import { buildStreamUrls } from "./urls.js";

function streamKey(id: string, kind: "main" | "sub"): string {
  return kind === "main" ? id : `${id}-sub`;
}

export function generateGo2rtc(cameras: CameraConfig[]): string {
  const streams: Record<string, string[]> = {};
  for (const cam of cameras) {
    const urls = buildStreamUrls(cam);
    streams[streamKey(cam.id, "main")] = [urls.main];
    streams[streamKey(cam.id, "sub")] = [urls.sub];
  }
  return yamlStringify({ streams });
}

export function generateFrigate(
  cameras: CameraConfig[],
  options?: { detectOnSub?: boolean }
): string {
  const detectOnSub = options?.detectOnSub !== false;
  const go2rtcStreams: Record<string, string[]> = {};
  const frigateCams: Record<string, unknown> = {};

  for (const cam of cameras) {
    const urls = buildStreamUrls(cam);
    const mainKey = streamKey(cam.id, "main");
    const subKey = streamKey(cam.id, "sub");
    go2rtcStreams[mainKey] = [urls.main];
    go2rtcStreams[subKey] = [urls.sub];

    frigateCams[cam.id] = {
      ffmpeg: {
        inputs: [
          {
            path: `rtsp://127.0.0.1:8554/${detectOnSub ? subKey : mainKey}`,
            roles: ["detect"],
          },
          {
            path: `rtsp://127.0.0.1:8554/${mainKey}`,
            roles: ["record"],
          },
        ],
      },
      detect: {
        width: 1280,
        height: 720,
        fps: 5,
      },
      objects: {
        track: ["person"],
      },
    };
  }

  const doc = {
    go2rtc: { streams: go2rtcStreams },
    cameras: frigateCams,
  };
  return yamlStringify(doc);
}

export function generateMediaMTX(cameras: CameraConfig[]): string {
  const paths: Record<string, { source: string }> = {};
  for (const cam of cameras) {
    const urls = buildStreamUrls(cam);
    paths[streamKey(cam.id, "main")] = { source: urls.main };
    paths[streamKey(cam.id, "sub")] = { source: urls.sub };
  }
  return yamlStringify({ paths });
}

export function generateJson(cameras: CameraConfig[]): string {
  const safe = cameras.map((cam) => {
    const urls = buildStreamUrls(cam);
    return {
      id: cam.id,
      name: cam.name,
      vendor: cam.vendor,
      host: cam.host,
      port: cam.port ?? 554,
      channel: cam.channel ?? 1,
      site: cam.site,
      tags: cam.tags,
      streams: {
        main: urls.main.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@"),
        sub: urls.sub.replace(/:\/\/([^:]+):([^@]+)@/, "://***:***@"),
      },
    };
  });
  return JSON.stringify(safe, null, 2);
}

export function generate(
  cameras: CameraConfig[],
  options: GenerateOptions
): string {
  switch (options.format) {
    case "go2rtc":
      return generateGo2rtc(cameras);
    case "frigate":
      return generateFrigate(cameras, {
        detectOnSub: options.detectOnSub,
      });
    case "mediamtx":
      return generateMediaMTX(cameras);
    case "json":
      return generateJson(cameras);
    default:
      throw new Error(`Unknown format: ${options.format}`);
  }
}
