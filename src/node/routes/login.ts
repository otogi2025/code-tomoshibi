import { Router, Request } from "express"
import { promises as fs } from "fs"
import { RateLimiter as Limiter } from "limiter"
import * as path from "path"
import { HttpCode } from "../../common/http"
import { rootPath } from "../constants"
import { authenticated, getCookieOptions, redirect, replaceTemplates } from "../http"
import i18n from "../i18n"
import { getPasswordMethod, handlePasswordValidation, sanitizeString, escapeHtml } from "../util"

// RateLimiter wraps around the limiter library for logins.
// It allows 2 logins every minute and at most 12 logins every hour.
//
// Both buckets have to agree, in both directions.  With "or" the hourly budget
// was decorative: once it ran out the minute bucket kept dripping a token every
// thirty seconds and `canTry` kept saying yes, so an attacker got unlimited
// attempts at 2/min forever instead of being cut off after 12 in the hour.
export class RateLimiter {
  private readonly minuteLimiter = new Limiter({ tokensPerInterval: 2, interval: "minute" })
  private readonly hourLimiter = new Limiter({ tokensPerInterval: 12, interval: "hour" })

  public canTry(): boolean {
    // Note: we must check using >= 1 because technically when there are no tokens left
    // you get back a number like 0.00013333333333333334
    // which would cause fail if the logic were > 0
    return this.minuteLimiter.getTokensRemaining() >= 1 && this.hourLimiter.getTokensRemaining() >= 1
  }

  public removeToken(): boolean {
    // Deliberately not short-circuited: an attempt has to cost a token in both
    // buckets, otherwise the hourly budget never drains.
    const removedMinute = this.minuteLimiter.tryRemoveTokens(1)
    const removedHour = this.hourLimiter.tryRemoveTokens(1)
    return removedMinute && removedHour
  }
}

const getRoot = async (req: Request, error?: Error): Promise<string> => {
  const content = await fs.readFile(path.join(rootPath, "src/browser/pages/login.html"), "utf8")
  const locale = req.args["locale"] || "en"
  i18n.changeLanguage(locale)
  const welcomeText = req.args["welcome-text"] || (i18n.t("WELCOME", { app: req.args["app-name"] }) as string)

  // Determine password message using i18n
  let passwordMsg = i18n.t("LOGIN_PASSWORD")
  if (req.args.usingEnvPassword) {
    passwordMsg = i18n.t("LOGIN_USING_ENV_PASSWORD")
  } else if (req.args.usingEnvHashedPassword) {
    passwordMsg = i18n.t("LOGIN_USING_HASHED_PASSWORD")
  }

  return replaceTemplates(
    req,
    content
      .replace(/{{I18N_LOGIN_TITLE}}/g, i18n.t("LOGIN_TITLE", { app: req.args["app-name"] }))
      .replace(/{{WELCOME_TEXT}}/g, welcomeText)
      .replace(/{{PASSWORD_MSG}}/g, passwordMsg)
      .replace(/{{I18N_LOGIN_BELOW}}/g, i18n.t("LOGIN_BELOW"))
      .replace(/{{I18N_PASSWORD_PLACEHOLDER}}/g, i18n.t("PASSWORD_PLACEHOLDER"))
      .replace(/{{I18N_SUBMIT}}/g, i18n.t("SUBMIT"))
      .replace(/{{ERROR}}/, error ? `<div class="error">${escapeHtml(error.message)}</div>` : ""),
  )
}

/* Being rate limited is not the same as getting the code wrong, and the page has to be able to
 * say which one happened: someone who is throttled but told "wrong code" just keeps trying and
 * burns the rest of the hourly budget for nothing. */
type FailureKind = "rate-limited" | "missing-password" | "incorrect-password"

/** Not in HttpCode, which only carries the codes the rest of the server needs. */
const TOO_MANY_REQUESTS = 429

const FAILURE_STATUS: Record<FailureKind, number> = {
  "rate-limited": TOO_MANY_REQUESTS,
  "missing-password": HttpCode.BadRequest,
  "incorrect-password": HttpCode.BadRequest,
}

const FAILURE_MESSAGE: Record<FailureKind, string> = {
  "rate-limited": "试得太频繁，等半分钟再试",
  "missing-password": "还没输密码",
  "incorrect-password": "密码不对",
}

class LoginFailure extends Error {
  public constructor(public readonly kind: FailureKind) {
    super(FAILURE_MESSAGE[kind])
  }
}

/* The gate posts with fetch and asks for JSON. A browser with no JavaScript posts the form
 * itself and gets this page back with the very same message rendered into it. */
const wantsJson = (req: Request): boolean => (req.get("accept") || "").includes("application/json")

const limiter = new RateLimiter()

export const router = Router()

router.use(async (req, res, next) => {
  const to = (typeof req.query.to === "string" && req.query.to) || "/"
  if (await authenticated(req)) {
    return redirect(req, res, to, { to: undefined })
  }
  next()
})

router.get("/", async (req, res) => {
  res.send(await getRoot(req))
})

/* The response is either the page itself or, for the gate's fetch, {"error": "..."}. */
type LoginResponse = string | { error: string }

router.post<{}, LoginResponse, { password?: string; base?: string } | undefined, { to?: string }>(
  "/",
  async (req, res) => {
    const password = sanitizeString(req.body?.password)
    const hashedPasswordFromArgs = req.args["hashed-password"]

    try {
      // Check to see if they exceeded their login attempts
      if (!limiter.canTry()) {
        throw new LoginFailure("rate-limited")
      }

      if (!password) {
        throw new LoginFailure("missing-password")
      }

      const passwordMethod = getPasswordMethod(hashedPasswordFromArgs)
      const { isPasswordValid, hashedPassword } = await handlePasswordValidation({
        passwordMethod,
        hashedPasswordFromArgs,
        passwordFromRequestBody: password,
        passwordFromArgs: req.args.password,
      })

      if (isPasswordValid) {
        // The hash does not add any actual security but we do it for
        // obfuscation purposes (and as a side effect it handles escaping).
        res.cookie(req.cookieSessionName, hashedPassword, getCookieOptions(req))

        const to = (typeof req.query.to === "string" && req.query.to) || "/"
        return redirect(req, res, to, { to: undefined })
      }

      // Note: successful logins should not count against the RateLimiter
      // which is why this logic must come after the successful login logic
      limiter.removeToken()

      console.error(
        "Failed login attempt",
        JSON.stringify({
          xForwardedFor: req.headers["x-forwarded-for"],
          remoteAddress: req.connection.remoteAddress,
          userAgent: req.headers["user-agent"],
          timestamp: Math.floor(new Date().getTime() / 1000),
        }),
      )

      throw new LoginFailure("incorrect-password")
    } catch (error: any) {
      const failure = error instanceof LoginFailure ? error : undefined
      const status = failure ? FAILURE_STATUS[failure.kind] : HttpCode.ServerError
      const message = failure ? failure.message : "登录失败，请重试"
      if (wantsJson(req)) {
        res.status(status).json({ error: message })
        return
      }
      res.status(status).send(await getRoot(req, failure ?? new Error(message)))
    }
  },
)
