import { RateLimiter } from "../../../../src/node/routes/login"
import { mockLogger } from "../../../utils/helpers"
import * as httpserver from "../../../utils/httpserver"
import * as integration from "../../../utils/integration"

describe("login", () => {
  beforeAll(() => {
    mockLogger()
  })

  describe("RateLimiter", () => {
    it("should allow one try ", () => {
      const limiter = new RateLimiter()
      expect(limiter.removeToken()).toBe(true)
    })

    it("should pull tokens from both limiters (minute & hour)", () => {
      const limiter = new RateLimiter()

      // Try twice, which pulls two from each bucket
      limiter.removeToken()
      limiter.removeToken()

      // The minute bucket is empty even though the hour bucket still holds 10.
      // This used to be allowed: `canTry` was an "or", so the hour bucket alone
      // was enough to let the attempt through and neither budget was ever
      // really enforced.  Both buckets must have a token now.
      expect(limiter.canTry()).toBe(false)
      expect(limiter.removeToken()).toBe(false)
    })

    it("should not allow more than 2 tries before the minute bucket drips", () => {
      const limiter = new RateLimiter()

      // The limiter allows 2 tries per minute and 12 per hour, and an attempt
      // has to be affordable in both.  2 is therefore the burst ceiling; the
      // hour bucket is charged in step with it, which is what stops the minute
      // bucket's drip from adding up to unlimited attempts once the hourly
      // budget is gone (that was the old "or" behaviour).
      for (let i = 1; i <= 2; i++) {
        expect(limiter.removeToken()).toBe(true)
      }

      expect(limiter.canTry()).toBe(false)
      expect(limiter.removeToken()).toBe(false)
    })
  })
  describe("/login", () => {
    let _codeServer: httpserver.HttpServer | undefined
    function codeServer(): httpserver.HttpServer {
      if (!_codeServer) {
        throw new Error("tried to use code-server before setting it up")
      }
      return _codeServer
    }

    // Store whatever might be in here so we can restore it afterward.
    // TODO: We should probably pass this as an argument somehow instead of
    // manipulating the environment.
    const previousEnvPassword = process.env.PASSWORD

    beforeEach(async () => {
      process.env.PASSWORD = "test"
      _codeServer = await integration.setup(["--auth=password"], "")
    })

    afterEach(async () => {
      process.env.PASSWORD = previousEnvPassword
      if (_codeServer) {
        await _codeServer.dispose()
        _codeServer = undefined
      }
    })

    it("should return 'Missing password' without body", async () => {
      const resp = await codeServer().fetch("/login", { method: "POST" })
      const htmlContent = await resp.text()
      expect(resp.status).toBe(400)
      expect(htmlContent).toContain("还没输密码")
    })

    it("should return JSON when the gate asks for it", async () => {
      const params = new URLSearchParams()
      params.append("password", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      const resp = await codeServer().fetch("/login", {
        method: "POST",
        body: params,
        headers: { Accept: "application/json" },
      })

      expect(resp.status).toBe(400)
      expect(await resp.json()).toStrictEqual({ error: "密码不对" })
    })

    it("should return HTML with 'Incorrect password' message", async () => {
      const params = new URLSearchParams()
      params.append("password", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      const resp = await codeServer().fetch("/login", {
        method: "POST",
        body: params,
      })

      expect(resp.status).toBe(400)

      const htmlContent = await resp.text()

      expect(htmlContent).toContain("密码不对")
    })

    // The field used to be locked to six digits (inputmode/pattern/maxlength plus
    // a `replace(/\D/g, "")` on every keystroke).  The password will not stay a
    // six-digit one once it becomes a hashed-password, so the field no longer
    // restricts what can be typed; the six-digit habit survives only as the
    // condition for submitting without pressing anything.
    it("should render the Code-Tomoshibi gate with an unrestricted password field", async () => {
      const resp = await codeServer().fetch("/login", { method: "GET" })
      const htmlContent = await resp.text()

      expect(resp.status).toBe(200)
      expect(htmlContent).toContain("<title>Code-Tomoshibi</title>")
      expect(htmlContent).toContain('id="code-input"')
      expect(htmlContent).toContain('type="password"')
      expect(htmlContent).not.toContain("inputmode=")
      expect(htmlContent).not.toContain("maxlength=")
      expect(htmlContent).not.toContain("pattern=")
      expect(htmlContent.match(/class="slot"/g)).toHaveLength(6)
    })

    it("should auto-submit only a six-digit code", async () => {
      const resp = await codeServer().fetch("/login", { method: "GET" })
      const htmlContent = await resp.text()

      expect(resp.status).toBe(200)
      expect(htmlContent).toContain("var CODE_LENGTH = 6")
      expect(htmlContent).toContain("var SIX_DIGITS = /^[0-9]{6}$/")
      expect(htmlContent).toContain("if (isSixDigitCode(input.value)) submitCode()")
      // Anything else is submitted by the button or by pressing enter.
      expect(htmlContent).toContain("if (submitting || !input.value) return")
    })

    it("should not leak private workbench state before authentication", async () => {
      const resp = await codeServer().fetch("/login", { method: "GET" })
      const htmlContent = await resp.text()

      expect(resp.status).toBe(200)
      expect(htmlContent).not.toContain("folder=/")
      expect(htmlContent).not.toContain("WebSocket(")
    })
  })
})
