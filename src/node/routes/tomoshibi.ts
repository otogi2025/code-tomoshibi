import { logger } from "@coder/logger"
import * as express from "express"
import { promises as fs, statfsSync } from "fs"
import * as os from "os"
import * as path from "path"

/* Code-Tomoshibi's own performance endpoint. The workbench status bar polls it twice a second
 * while its tab is visible, so sampling is done on demand and nothing runs in the
 * background: each request reads /proc, diffs it against the counters the previous request
 * left behind, and stores the fresh counters for the next one. When nobody is looking the
 * VPS pays nothing.
 *
 * Every field degrades to null on its own rather than failing the request, because a status
 * bar that shows a dash for one number is far better than one that shows nothing at all. */

/* Two requests closer together than this share one sample. The two caches are separate objects
 * and now have separate windows: the status bar polls the basic snapshot twice a second, so a
 * one second cache would serve every other request a stale sample and compute rates off a stale
 * counter; the detail sample walks every /proc/<pid> and stays deliberately slow. */
const BASIC_CACHE_MS = 250
const DETAIL_CACHE_MS = 2000

/** Counters older than this cannot produce a trustworthy rate, so rates report null instead. */
const COUNTER_MAX_AGE_MS = 30_000

/** How many processes the detail popover lists under "busiest". */
const TOP_PROCESS_COUNT = 3

/* /proc/<pid>/stat fields are numbered from 1 in `man 5 proc`: pid, comm and state come
 * first, and the comm field may itself contain spaces and parentheses. Splitting after the
 * last ')' therefore drops fields 1 and 2, leaving state at index 0 -- so field N lands at
 * index N - 3, which puts utime (14) at 11 and stime (15) at 12. */
const UTIME_INDEX = 11
const STIME_INDEX = 12

interface CpuCounters {
  readonly total: number
  readonly idle: number
}

interface NetworkCounters {
  readonly received: number
  readonly transmitted: number
}

interface SystemCounters {
  readonly at: number
  readonly cpu?: CpuCounters
  readonly network?: NetworkCounters
}

interface ProcessSample {
  readonly name: string
  readonly jiffies: number
}

interface ProcessCounters {
  readonly at: number
  readonly cpuTotal: number
  readonly processes: Map<number, ProcessSample>
}

interface PerformanceProcess {
  readonly name: string
  readonly cpuPercent: number
}

interface PerformanceSnapshot {
  readonly hostname: string
  readonly cpuCores: number
  readonly cpuPercent: number | null
  readonly memoryUsedBytes: number | null
  readonly memoryTotalBytes: number | null
  readonly swapUsedBytes: number | null
  readonly swapTotalBytes: number | null
  readonly diskUsedBytes: number | null
  readonly diskTotalBytes: number | null
  readonly downloadBytesPerSecond: number | null
  readonly uploadBytesPerSecond: number | null
  readonly sampledAt: number
  readonly top?: PerformanceProcess[]
}

interface CachedSnapshot {
  readonly at: number
  readonly value: PerformanceSnapshot
}

/* The host name never changes while the process lives, so it is resolved once. */
const hostname = os.hostname()

let previousCounters: SystemCounters | undefined
let previousProcesses: ProcessCounters | undefined
let basicCache: CachedSnapshot | undefined
let detailCache: CachedSnapshot | undefined

const readCpuCounters = async (): Promise<CpuCounters | undefined> => {
  try {
    const firstLine = (await fs.readFile("/proc/stat", "utf8")).split("\n")[0]
    const values = firstLine.trim().split(/\s+/).slice(1).map(Number)
    if (values.length < 5 || values.some((value) => !Number.isFinite(value))) {
      return undefined
    }
    // busy = total - idle - iowait, so idle and iowait travel together.
    return { total: values.reduce((sum, value) => sum + value, 0), idle: values[3] + values[4] }
  } catch {
    return undefined
  }
}

const readNetworkCounters = async (): Promise<NetworkCounters | undefined> => {
  try {
    const text = await fs.readFile("/proc/net/dev", "utf8")
    let received = 0
    let transmitted = 0
    let interfaces = 0
    for (const line of text.split("\n")) {
      const separator = line.indexOf(":")
      if (separator === -1) {
        continue
      }
      const name = line.slice(0, separator).trim()
      // Loopback traffic is not traffic to the client's device.
      if (!name || name === "lo") {
        continue
      }
      const values = line
        .slice(separator + 1)
        .trim()
        .split(/\s+/)
        .map(Number)
      if (values.length < 9 || !Number.isFinite(values[0]) || !Number.isFinite(values[8])) {
        continue
      }
      received += values[0]
      transmitted += values[8]
      interfaces++
    }
    return interfaces > 0 ? { received, transmitted } : undefined
  } catch {
    return undefined
  }
}

const readMemoryInfo = async (): Promise<Map<string, number> | undefined> => {
  try {
    const text = await fs.readFile("/proc/meminfo", "utf8")
    const values = new Map<string, number>()
    for (const line of text.split("\n")) {
      const separator = line.indexOf(":")
      if (separator === -1) {
        continue
      }
      // Every value we need is reported in kB.
      const value = Number(
        line
          .slice(separator + 1)
          .trim()
          .split(/\s+/)[0],
      )
      if (Number.isFinite(value)) {
        values.set(line.slice(0, separator), value)
      }
    }
    return values
  } catch {
    return undefined
  }
}

const kilobytesToBytes = (values: Map<string, number> | undefined, key: string): number | undefined => {
  const value = values?.get(key)
  return typeof value === "number" ? value * 1024 : undefined
}

const readProcessSample = async (): Promise<Map<number, ProcessSample>> => {
  const samples = new Map<number, ProcessSample>()
  let entries: string[]
  try {
    entries = await fs.readdir("/proc")
  } catch {
    return samples
  }
  await Promise.all(
    entries.map(async (entry) => {
      const pid = Number(entry)
      if (!Number.isInteger(pid) || pid <= 0) {
        return
      }
      try {
        const stat = await fs.readFile(`/proc/${pid}/stat`, "utf8")
        const open = stat.indexOf("(")
        const close = stat.lastIndexOf(")")
        if (open === -1 || close === -1 || close < open) {
          return
        }
        const fields = stat
          .slice(close + 1)
          .trim()
          .split(/\s+/)
        const utime = Number(fields[UTIME_INDEX])
        const stime = Number(fields[STIME_INDEX])
        if (!Number.isFinite(utime) || !Number.isFinite(stime)) {
          return
        }
        samples.set(pid, { name: stat.slice(open + 1, close), jiffies: utime + stime })
      } catch {
        // Processes come and go between readdir and read; one that vanished is simply skipped.
      }
    }),
  )
  return samples
}

/* `node` on its own says nothing, so the script name is appended: "node gate.js". */
const describeProcess = async (pid: number, comm: string): Promise<string> => {
  if (comm !== "node") {
    return comm
  }
  try {
    const argv = (await fs.readFile(`/proc/${pid}/cmdline`, "utf8")).split("\0").filter((part) => part.length > 0)
    const script = argv.length > 1 ? path.basename(argv[1]) : ""
    return script ? `${comm} ${script}` : comm
  } catch {
    return comm
  }
}

const readTopProcesses = async (cpuTotal: number | undefined, now: number): Promise<PerformanceProcess[]> => {
  const processes = await readProcessSample()
  const previous = previousProcesses
  previousProcesses = typeof cpuTotal === "number" ? { at: now, cpuTotal, processes } : undefined
  if (!previous || typeof cpuTotal !== "number") {
    // Without a previous sample there is no rate to report yet.
    return []
  }
  const jiffiesDelta = cpuTotal - previous.cpuTotal
  if (!(jiffiesDelta > 0) || now - previous.at > COUNTER_MAX_AGE_MS) {
    return []
  }
  const ranked: { pid: number; name: string; cpuPercent: number }[] = []
  for (const [pid, sample] of processes) {
    const before = previous.processes.get(pid)
    if (!before) {
      continue
    }
    const delta = sample.jiffies - before.jiffies
    if (delta <= 0) {
      continue
    }
    ranked.push({ pid, name: sample.name, cpuPercent: (delta / jiffiesDelta) * 100 })
  }
  ranked.sort((first, second) => second.cpuPercent - first.cpuPercent)
  return Promise.all(
    ranked.slice(0, TOP_PROCESS_COUNT).map(async (entry) => ({
      name: await describeProcess(entry.pid, entry.name),
      cpuPercent: entry.cpuPercent,
    })),
  )
}

const sample = async (detail: boolean): Promise<PerformanceSnapshot> => {
  const now = Date.now()
  const [cpu, network, memoryInfo] = await Promise.all([readCpuCounters(), readNetworkCounters(), readMemoryInfo()])

  const previous = previousCounters
  previousCounters = { at: now, cpu, network }
  const elapsedSeconds = previous ? (now - previous.at) / 1000 : 0
  const fresh = !!previous && now - previous.at <= COUNTER_MAX_AGE_MS && elapsedSeconds > 0

  let cpuPercent: number | null = null
  if (fresh && cpu && previous?.cpu) {
    const totalDelta = cpu.total - previous.cpu.total
    const idleDelta = cpu.idle - previous.cpu.idle
    if (totalDelta > 0) {
      cpuPercent = Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100))
    }
  }

  let downloadBytesPerSecond: number | null = null
  let uploadBytesPerSecond: number | null = null
  if (fresh && network && previous?.network) {
    const receivedDelta = network.received - previous.network.received
    const transmittedDelta = network.transmitted - previous.network.transmitted
    // A counter that went backwards means an interface was reset; report nothing rather than a lie.
    if (receivedDelta >= 0 && transmittedDelta >= 0) {
      downloadBytesPerSecond = receivedDelta / elapsedSeconds
      uploadBytesPerSecond = transmittedDelta / elapsedSeconds
    }
  }

  const memoryTotalBytes = kilobytesToBytes(memoryInfo, "MemTotal")
  const memoryAvailableBytes = kilobytesToBytes(memoryInfo, "MemAvailable")
  const swapTotalBytes = kilobytesToBytes(memoryInfo, "SwapTotal")
  const swapFreeBytes = kilobytesToBytes(memoryInfo, "SwapFree")

  let diskUsedBytes: number | null = null
  let diskTotalBytes: number | null = null
  try {
    // bfree, not bavail: the root-reserved blocks count as used in what df prints.
    const stats = statfsSync(os.homedir())
    diskTotalBytes = stats.blocks * stats.bsize
    diskUsedBytes = (stats.blocks - stats.bfree) * stats.bsize
  } catch {
    diskUsedBytes = null
    diskTotalBytes = null
  }

  const snapshot: PerformanceSnapshot = {
    hostname,
    cpuCores: os.cpus().length,
    cpuPercent,
    memoryUsedBytes:
      memoryTotalBytes !== undefined && memoryAvailableBytes !== undefined
        ? Math.max(0, memoryTotalBytes - memoryAvailableBytes)
        : null,
    memoryTotalBytes: memoryTotalBytes ?? null,
    swapUsedBytes:
      swapTotalBytes !== undefined && swapFreeBytes !== undefined ? Math.max(0, swapTotalBytes - swapFreeBytes) : null,
    swapTotalBytes: swapTotalBytes ?? null,
    diskUsedBytes,
    diskTotalBytes,
    downloadBytesPerSecond,
    uploadBytesPerSecond,
    sampledAt: now,
  }

  // Walking every /proc/<pid> costs hundreds of reads, so it happens only for the open popover.
  return detail ? { ...snapshot, top: await readTopProcesses(cpu?.total, now) } : snapshot
}

export const performance = async (req: express.Request, res: express.Response): Promise<void> => {
  const detail = req.query.detail === "1"
  const now = Date.now()
  const cached = detail ? detailCache : basicCache

  res.setHeader("Cache-Control", "no-store")

  if (cached && now - cached.at < (detail ? DETAIL_CACHE_MS : BASIC_CACHE_MS)) {
    res.json(cached.value)
    return
  }

  try {
    const value = await sample(detail)
    const entry: CachedSnapshot = { at: now, value }
    if (detail) {
      detailCache = entry
    } else {
      basicCache = entry
    }
    res.json(value)
  } catch (error) {
    // Never fail the request: an empty snapshot renders as a row of dashes.
    logger.warn(`Tomoshibi performance sample failed: ${error instanceof Error ? error.message : String(error)}`)
    res.json({
      hostname,
      cpuCores: os.cpus().length,
      cpuPercent: null,
      memoryUsedBytes: null,
      memoryTotalBytes: null,
      swapUsedBytes: null,
      swapTotalBytes: null,
      diskUsedBytes: null,
      diskTotalBytes: null,
      downloadBytesPerSecond: null,
      uploadBytesPerSecond: null,
      sampledAt: now,
      ...(detail ? { top: [] } : {}),
    })
  }
}
