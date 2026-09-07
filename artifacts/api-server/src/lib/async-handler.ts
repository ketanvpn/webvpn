import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express route handler so that rejected promises
 * are forwarded to Express error-handling middleware via `next(err)`.
 *
 * Without this wrapper, Express 4 silently swallows unhandled rejections
 * from async handlers, causing the request to hang until the client times out.
 *
 * @example
 *   router.get("/foo", asyncHandler(async (req, res) => {
 *     const data = await db.query(...);   // if this throws, next(err) is called
 *     res.json(data);
 *   }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
