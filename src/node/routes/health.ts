import { Router } from "express"
import { ensureOrigin } from "../http"
import { wss, Router as WsRouter } from "../wsRouter"

export const router = Router()

router.get("/", (req, res) => {
  res.json({
    status: req.heart.alive() ? "alive" : "expired",
    lastHeartbeat: req.heart.lastHeartbeat,
  })
})

export const wsRouter = WsRouter()

// `wsRouter.ws` does not check the origin for us, so ask for it here the same
// way routes/vscode.ts does.  Otherwise any page on the internet could open
// this socket against a code-server the visitor can reach.
wsRouter.ws("/", ensureOrigin, async (req) => {
  wss.handleUpgrade(req, req.ws, req.head, (ws) => {
    ws.addEventListener("message", () => {
      ws.send(
        JSON.stringify({
          event: "health",
          status: req.heart.alive() ? "alive" : "expired",
          lastHeartbeat: req.heart.lastHeartbeat,
        }),
      )
    })
    req.ws.resume()
  })
})
