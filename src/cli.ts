#!/usr/bin/env node
/**
 * Stream Sentinel CLI
 *   stream-sentinel check -f cameras.json
 *   stream-sentinel generate -f cameras.json --format frigate
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import type { CameraConfig } from "./types.js";
import { checkFleet } from "./fleet.js";
import { generate } from "./generate.js";

const program = new Command();

program
  .name("stream-sentinel")
  .description(
    "RTSP dual-stream health monitor & config generator for multi-camera fleets"
  )
  .version("1.0.0");

function loadCameras(path: string): CameraConfig[] {
  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("Camera file must be a JSON array of camera configs");
  }
  return data as CameraConfig[];
}

program
  .command("check")
  .description("Probe main + sub streams for every camera in the fleet")
  .requiredOption("-f, --file <path>", "Path to cameras JSON")
  .option("-c, --concurrency <n>", "Parallel probes", "5")
  .option("--tcp-only", "Skip ffprobe; TCP reachability only")
  .option("-o, --output <path>", "Write full JSON report to file")
  .action(async (opts) => {
    const cameras = loadCameras(opts.file);
    console.log(`Checking ${cameras.length} camera(s)...\n`);

    const report = await checkFleet(cameras, {
      concurrency: Number(opts.concurrency),
      preferFfprobe: !opts.tcpOnly,
    });

    for (const r of report.results) {
      const icon =
        r.overall === "healthy" ? "✓" : r.overall === "degraded" ? "!" : "✗";
      console.log(
        `${icon} ${r.name} (${r.cameraId})  main=${r.main.reachable ? "OK" : "FAIL"}  sub=${r.sub.reachable ? "OK" : "FAIL"}  ${r.overall}`
      );
      if (r.main.latencyMs != null) {
        console.log(
          `    main latency ${r.main.latencyMs}ms ${r.main.resolution ?? ""} ${r.main.codec ?? ""}`
        );
      }
      if (r.sub.error) console.log(`    sub error: ${r.sub.error}`);
      if (r.main.error) console.log(`    main error: ${r.main.error}`);
    }

    console.log(
      `\nSummary: ${report.healthy} healthy · ${report.degraded} degraded · ${report.down} down / ${report.total}`
    );

    if (opts.output) {
      writeFileSync(opts.output, JSON.stringify(report, null, 2));
      console.log(`Report written to ${opts.output}`);
    }

    if (report.down > 0) process.exitCode = 2;
    else if (report.degraded > 0) process.exitCode = 1;
  });

program
  .command("generate")
  .description("Generate go2rtc / Frigate / MediaMTX dual-stream configs")
  .requiredOption("-f, --file <path>", "Path to cameras JSON")
  .option(
    "--format <fmt>",
    "Output format: go2rtc | frigate | mediamtx | json",
    "go2rtc"
  )
  .option("-o, --output <path>", "Write config to file (default: stdout)")
  .action((opts) => {
    const cameras = loadCameras(opts.file);
    const format = opts.format as "go2rtc" | "frigate" | "mediamtx" | "json";
    const out = generate(cameras, {
      format,
      detectOnSub: true,
      recordOnMain: true,
    });
    if (opts.output) {
      writeFileSync(opts.output, out);
      console.log(`Wrote ${format} config → ${opts.output}`);
    } else {
      process.stdout.write(out);
    }
  });

program
  .command("urls")
  .description("Print dual-stream RTSP URLs for each camera (credentials redacted)")
  .requiredOption("-f, --file <path>", "Path to cameras JSON")
  .action((opts) => {
    const cameras = loadCameras(opts.file);
    const out = generate(cameras, { format: "json" });
    console.log(out);
  });

program.parse();
