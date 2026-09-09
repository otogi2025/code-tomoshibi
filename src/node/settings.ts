import { logger } from "@coder/logger"
import * as crypto from "crypto"
import { promises as fs } from "fs"
import type { ParsedQs } from "qs"

export type Settings = { [key: string]: Settings | string | boolean | number }

/**
 * Provides read and write access to settings.
 */
export class SettingsProvider<T> {
  public constructor(private readonly settingsPath: string) {}

  /**
   * Read settings from the file. On a failure return last known settings and
   * log a warning.
   */
  public async read(): Promise<T> {
    try {
      const raw = (await fs.readFile(this.settingsPath, "utf8")).trim()
      return raw ? JSON.parse(raw) : ({} as T)
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        logger.warn(error.message)
      }
    }
    return {} as T
  }

  /**
   * Write settings combined with current settings. On failure log a warning.
   * Settings will be merged shallowly.
   *
   * The file is written next to its final location and moved into place, so an
   * interrupted or concurrent write cannot leave truncated JSON behind.  Half a
   * file is not a recoverable state here: `read` cannot parse it and silently
   * falls back to empty settings, which loses the last opened folder.
   */
  public async write(settings: Partial<T>): Promise<void> {
    try {
      const oldSettings = await this.read()
      const nextSettings = { ...oldSettings, ...settings }
      const tempPath = `${this.settingsPath}.${crypto.randomBytes(6).toString("hex")}.tmp`
      try {
        await fs.writeFile(tempPath, JSON.stringify(nextSettings, null, 2))
        await fs.rename(tempPath, this.settingsPath)
      } catch (error) {
        // Do not leave the scratch file behind if either step failed.
        await fs.rm(tempPath, { force: true })
        throw error
      }
    } catch (error: any) {
      logger.warn(error.message)
    }
  }
}

/**
 * Global code-server settings.
 */
export interface CoderSettings {
  query?: ParsedQs
}
