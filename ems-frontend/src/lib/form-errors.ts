import { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api";

export function applyApiFieldErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>
): string | null {
  if (!(err instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }

  if (err.errors) {
    for (const [field, message] of Object.entries(err.errors)) {
      setError(field as Path<T>, { message });
    }
  }

  return err.message;
}
