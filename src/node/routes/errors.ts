import { logger } from "@coder/logger"
import express from "express"
import { promises as fs } from "fs"
import path from "path"
import { HttpCode } from "../../common/http"
import { rootPath } from "../constants"
import { replaceTemplates } from "../http"
import { escapeHtml, getMediaMime } from "../util"
import type { WebsocketRequest } from "../wsRouter"

interface ErrorWithStatusCode {
  statusCode: number
}

interface ErrorWithCode {
  code: string
}

/** Error is network related. */
export const errorHasStatusCode = (error: any): error is ErrorWithStatusCode => {
  return error && "statusCode" in error
}

/** Error originates from file system. */
export const errorHasCode = (error: any): error is ErrorWithCode => {
  return error && "code" in error
}

const notFoundCodes = [404, "ENOENT", "EISDIR"]

/**
 * What a 5xx tells the client.  The real message can name internal paths, the
 * configuration, or whatever a dependency decided to put in an exception, none
 * of which the client is owed; it goes to the log instead.  4xx messages are
 * about the request itself and are still returned as-is.
 */
const SERVER_ERROR_MESSAGE = "Internal server error"

/**
 * Final HTTP error handler.
 *
 * Note: This handler intentionally does not call `next()` even though it
 * accepts it as an argument; it is expected to be mounted last.
 */
export const errorHandler: express.ErrorRequestHandler = async (err, req, res, next) => {
  let statusCode = 500

  if (errorHasStatusCode(err)) {
    statusCode = err.statusCode
  } else if (errorHasCode(err) && notFoundCodes.includes(err.code)) {
    statusCode = HttpCode.NotFound
  }

  const isServerError = statusCode >= HttpCode.ServerError
  if (isServerError) {
    logger.error(`${err.message} ${err.stack}`)
  }
  const message = isServerError ? SERVER_ERROR_MESSAGE : err.message

  res.status(statusCode)

  // Assume anything that explicitly accepts text/html is a user browsing a
  // page (as opposed to an xhr request). Don't use `req.accepts()` since
  // *every* request that I've seen (in Firefox and Chromium at least)
  // includes `*/*` making it always truthy. Even for css/javascript.
  if (req.headers.accept && req.headers.accept.includes("text/html")) {
    const resourcePath = path.resolve(rootPath, "src/browser/pages/error.html")
    res.set("Content-Type", getMediaMime(resourcePath))
    const content = await fs.readFile(resourcePath, "utf8")
    res.send(
      replaceTemplates(req, content)
        .replace(/{{ERROR_TITLE}}/g, statusCode.toString())
        .replace(/{{ERROR_HEADER}}/g, statusCode.toString())
        .replace(/{{ERROR_BODY}}/g, escapeHtml(message))
        .replace(/{{APP_NAME}}/g, req.args["app-name"]),
    )
  } else {
    res.json({
      error: message,
      // `details` is filled in by the code that raised the error, so it is only
      // safe to pass along for the 4xx errors we still describe.
      ...(isServerError ? {} : err.details || {}),
    })
  }
}

/**
 * Final WebSocket error handler.
 *
 * Note: This handler intentionally does not call `next()` even though it
 * accepts it as an argument; it is expected to be mounted last.
 */
export const wsErrorHandler: express.ErrorRequestHandler = async (err, req, res, next) => {
  let statusCode = 500
  if (errorHasStatusCode(err)) {
    statusCode = err.statusCode
  } else if (errorHasCode(err) && notFoundCodes.includes(err.code)) {
    statusCode = HttpCode.NotFound
  }
  const isServerError = statusCode >= HttpCode.ServerError
  if (isServerError) {
    logger.error(`${err.message} ${err.stack}`)
  } else {
    logger.debug(`${err.message} ${err.stack}`)
  }
  const message = isServerError ? SERVER_ERROR_MESSAGE : err.message
  ;(req as WebsocketRequest).ws.end(`HTTP/1.1 ${statusCode} ${message}\r\n\r\n`)
}
