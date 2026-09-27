import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".");

    return res.status(400).json({
      message: field ? `${field}: ${issue.message}` : "Invalid request",
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  const status = (error as { status?: unknown } | null)?.status;

  if (status === 413) {
    return res.status(413).json({ message: "Request is too large. Attachments must be 10 MB or less in total." });
  }

  if (status === 400) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  console.error("Unhandled request error:", error);

  res.status(500).json({ message: "Something went wrong" });
}
