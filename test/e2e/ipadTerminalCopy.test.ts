import { promises as fs } from "fs"
import * as path from "path"
import { describe, expect, test } from "./baseFixture"

const ipadUserAgent =
  "Mozilla/5.0 (Macintosh; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

describe("iPad terminal line copy", ["--disable-workspace-trust"], {}, () => {
  test.use({
    userAgent: ipadUserAgent,
    hasTouch: true,
    viewport: { width: 1024, height: 768 },
    permissions: ["clipboard-read", "clipboard-write"],
  })

  test("long press can copy the selected terminal row", async ({ codeServerPage }) => {
    const page = codeServerPage.page
    const browserDevice = await page.evaluate(() => ({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints }))
    expect(browserDevice.userAgent).toContain("Macintosh")
    expect(browserDevice.maxTouchPoints).toBeGreaterThan(0)
    await codeServerPage.focusTerminal()
    await expect(page.locator('.xterm[data-tomoshibi-touch-selection="enabled"]')).toBeVisible()

    const marker = "TOMOSHIBI_COPY_LINE_E2E"
    const markerFile = path.join(await codeServerPage.workspaceDir, "ipad-copy-marker.txt")
    await page.keyboard.type(`printf '${marker}\\n' | tee '${markerFile}'`)
    await page.keyboard.press("Enter")
    await expect.poll(async () => fs.readFile(markerFile, "utf8").catch(() => "")).toContain(marker)

    const point = await page.evaluate(() => {
      const screen = document.querySelector<HTMLElement>(".xterm-screen")
      const terminal = document.querySelector<HTMLElement>(".xterm")
      if (!screen || !terminal) {
        throw new Error("xterm screen not found")
      }
      const screenBox = screen.getBoundingClientRect()
      const fontSize = Number.parseFloat(getComputedStyle(terminal).fontSize) || 14
      const cellHeight = Math.max(16, fontSize * 1.2)
      // A fresh test terminal starts with the command on row 0 and its output
      // on row 1. The production xterm uses a 1.2 line-height at this font size.
      return { x: screenBox.left + fontSize * 2, y: screenBox.top + cellHeight * 1.5 }
    })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y }],
    })
    await page.waitForTimeout(500)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })

    const menu = page.getByRole("toolbar", { name: "终端复制" })
    await expect(menu).toBeVisible()
    await menu.getByRole("button", { name: "复制整行" }).click()

    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain(marker)
  })
})
