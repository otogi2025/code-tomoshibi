import { describe, expect, test } from "./baseFixture"

describe("Code-Tomoshibi watchdog", ["--disable-workspace-trust"], {}, () => {
  test("shows an active repair and sends a scoped cancel request", async ({ codeServerPage }) => {
    const page = codeServerPage.page
    let cancelledIncident = ""

    await page.route("**/_gate/watchdog/**", async (route) => {
      const request = route.request()
      const pathname = new URL(request.url()).pathname

      if (pathname.endsWith("/status")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            active: true,
            incidentId: "e2e-watchdog-incident",
            phase: "repairing",
            title: "测试修复通知",
            message: "正在验证核心看门狗弹窗",
            reason: "E2E",
            cancellable: true,
            updatedAt: Date.now(),
          }),
        })
        return
      }

      if (pathname.endsWith("/cancel")) {
        const body = request.postDataJSON() as { incidentId?: string }
        cancelledIncident = body.incidentId ?? ""
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) })
        return
      }

      if (pathname.endsWith("/external-token")) {
        await route.fulfill({ contentType: "application/json", body: "{}" })
        return
      }

      await route.fulfill({ status: 204 })
    })

    await page.reload()
    const alert = page.locator(".tomoshibi-watchdog-alert")
    await expect(alert).toBeVisible()
    await expect(alert).toContainText("测试修复通知")
    await expect(alert).toContainText("正在验证核心看门狗弹窗")

    await alert.getByRole("button", { name: "停止本次修复并暂停 1 小时" }).click()
    await expect(alert).toContainText("已发送停止请求")
    expect(cancelledIncident).toBe("e2e-watchdog-incident")
  })

  test("dismisses the current alert until its status changes", async ({ codeServerPage }) => {
    const page = codeServerPage.page
    let updatedAt = 1
    let title = "测试可关闭通知"

    await page.route("**/_gate/watchdog/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname

      if (pathname.endsWith("/status")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            active: true,
            incidentId: "e2e-dismissible-incident",
            phase: "failed",
            title,
            message: "确认后不应重复显示同一状态",
            cancellable: false,
            updatedAt,
          }),
        })
        return
      }

      if (pathname.endsWith("/external-token")) {
        await route.fulfill({ contentType: "application/json", body: "{}" })
        return
      }

      await route.fulfill({ status: 204 })
    })

    await page.reload()
    const alert = page.locator(".tomoshibi-watchdog-alert")
    await expect(alert).toBeVisible()
    await alert.getByRole("button", { name: "确认并关闭" }).click()
    await expect(alert).toBeHidden()

    await page.waitForTimeout(5500)
    await expect(alert).toBeHidden()

    updatedAt = 2
    await page.waitForTimeout(5500)
    await expect(alert).toBeHidden()

    title = "测试新阶段通知"
    await expect(alert).toBeVisible({ timeout: 7000 })
    await expect(alert).toContainText("测试新阶段通知")
  })
})
