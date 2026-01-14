import { z } from "zod";

export enum ErrorType {
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  ILLEGAL_ARGUMENT = "ILLEGAL_ARGUMENT",
  BAD_REQUEST = "BAD_REQUEST",
  CONFLICT = "CONFLICT",
}

export const ApiErrorSchema = z.object({
  status: z.number(),
  type: z.nativeEnum(ErrorType),
  message: z.string(),
  timestamp: z.string(),
  path: z.string().optional(),
  details: z.string().optional(),
  helpUrl: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export class ApiErrorException extends Error {
  public readonly error: ApiError;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiErrorException";
    this.error = error;
  }
}
