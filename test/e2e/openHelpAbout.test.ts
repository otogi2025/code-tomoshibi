import { describe, test, expect } from "./baseFixture"

describe("Code-Tomoshibi compact menu", ["--disable-workspace-trust"], {}, () => {
  test("should expose the focused product actions", async ({ codeServerPage }) => {
    await codeServerPage.page.click('.menubar-menu-button[aria-haspopup="true"]')

    for (const label of [
      "文件",
      "搜索文件和内容",
      "上传文件",
      "新建终端",
      "打开 Codex",
      "打开 Claude Code",
      "Session 管理中心",
      "扩展中心",
      "常用设置",
    ]) {
      await expect(codeServerPage.page.locator(".monaco-menu").getByText(label, { exact: true })).toBeVisible()
    }
  })
})
