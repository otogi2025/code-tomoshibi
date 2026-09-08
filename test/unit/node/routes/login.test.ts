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

      // Try twice, which pulls two from the minute bucket
      limiter.removeToken()
      limiter.removeToken()

      // Check that we can still try
      // which should be true since there are 12 remaining in the hour bucket
      expect(limiter.canTry()).toBe(true)
      expect(limiter.removeToken()).toBe(true)
    })

    it("should not allow more than 14 tries in less than an hour", () => {
      const limiter = new RateLimiter()

      // The limiter allows 2 tries per minute plus 12 per hour
      // so if we run it 15 times, 14 should return true and the last
      // should return false
      for (let i = 1; i <= 14; i++) {
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
      expect(resp.status).toBe(200)
      expect(htmlContent).toContain("Missing password")
    })

    it("should return HTML with 'Incorrect password' message", async () => {
      const params = new URLSearchParams()
      params.append("password", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      const resp = await codeServer().fetch("/login", {
        method: "POST",
        body: params,
      })

      expect(resp.status).toBe(200)

      const htmlContent = await resp.text()

      expect(htmlContent).toContain("Incorrect password")
    })

    it("should render the compact six-digit Code-Tomoshibi gate", async () => {
      const resp = await codeServer().fetch("/login", { method: "GET" })
      const htmlContent = await resp.text()

      expect(resp.status).toBe(200)
      expect(htmlContent).toContain("<title>Code-Tomoshibi</title>")
      expect(htmlContent).toContain('id="code-input"')
      expect(htmlContent).toContain('inputmode="numeric"')
      expect(htmlContent).toContain('maxlength="6"')
      expect(htmlContent.match(/class="slot"/g)).toHaveLength(6)
    })

    it("should auto-submit only after six sanitized digits", async () => {
      const resp = await codeServer().fetch("/login", { method: "GET" })
      const htmlContent = await resp.text()

      expect(resp.status).toBe(200)
      expect(htmlContent).toContain("var CODE_LENGTH = 6")
      expect(htmlContent).toContain('input.value.replace(/\\D/g, "").slice(0, CODE_LENGTH)')
      expect(htmlContent).toContain("if (submitting || input.value.length !== CODE_LENGTH) return")
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
