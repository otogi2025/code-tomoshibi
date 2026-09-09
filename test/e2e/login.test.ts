import { PASSWORD } from "../utils/constants"
import { describe, test, expect } from "./baseFixture"

describe("login", ["--disable-workspace-trust", "--auth", "password"], {}, () => {
  test("should see the login page", async ({ codeServerPage }) => {
    // It should send us to the login page
    expect(await codeServerPage.page.title()).toBe("Code-Tomoshibi")
    await expect(codeServerPage.page.locator("#code-input")).toBeVisible()
    await expect(codeServerPage.page.locator(".slots > .slot")).toHaveCount(6)
  })

  test("should be able to login", async ({ codeServerPage }) => {
    // Six digits submit automatically; there is no extra button in the gate.
    await codeServerPage.page.fill("#code-input", PASSWORD)
    await codeServerPage.page.waitForLoadState("networkidle")
    // We do this because occassionally code-server doesn't load on Firefox
    // but loads if you reload once or twice
    await codeServerPage.reloadUntilEditorIsReady()
    // Make sure the editor actually loaded
    expect(await codeServerPage.isEditorVisible()).toBe(true)
  })

  test("should see an error message for missing password", async ({ codeServerPage }) => {
    const input = codeServerPage.page.locator("#code-input")
    await expect(input).toHaveValue("")
    expect(await input.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false)
  })

  test("should see an error message for incorrect password", async ({ codeServerPage }) => {
    await codeServerPage.page.fill("#code-input", "111111")
    await expect(codeServerPage.page.locator("#gate-status")).toHaveText("密码不对")
  })

  test("should hit the rate limiter for too many unsuccessful logins", async ({ codeServerPage }) => {
    test.slow()
    const responses: string[] = []
    for (let i = 0; i < 15; i++) {
      const response = await codeServerPage.page.request.post(codeServerPage.page.url(), {
        form: { password: "111111" },
      })
      responses.push(await response.text())
    }

    // Rate limiting now reads differently from a wrong code, both in the response and on
    // the gate itself, so a throttled user is not told to keep guessing.
    expect(responses.some((body) => body.includes("试得太频繁，等半分钟再试"))).toBe(true)
  })
})
