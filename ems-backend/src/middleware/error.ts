import { NextFunction, Request, Response } from "express";
import { ZodError, ZodSchema } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: Record<string, string>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function formatZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(
        new AppError(400, "Validation failed", formatZodErrors(result.error))
      );
      return;
    }
    req[part] = result.data;
    next();
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(
      err.errors
        ? { message: err.message, errors: err.errors }
        : { message: err.message }
    );
    return;
  }

  // Multer upload errors
  if (err instanceof Error && err.name === "MulterError") {
    const code = (err as Error & { code?: string }).code;
    if (code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "CSV file too large (max 2 MB)" });
      return;
    }
    res.status(400).json({ message: err.message || "File upload failed" });
    return;
  }

  // CORS errors from cors package
  if (err instanceof Error && err.message.startsWith("CORS blocked")) {
    res.status(403).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
