import { createSerializationAdapter } from "@tanstack/router-core";
import {
  type ApiError,
  ApiErrorException,
  ApiErrorSchema,
} from "~/types/errors";

/** Preserve structured backend errors across TanStack server-function calls. */
export const apiErrorSerializationAdapter = createSerializationAdapter<
  ApiErrorException,
  ApiError
>({
  key: "lumi-api-error",
  test: (value): value is ApiErrorException =>
    value instanceof ApiErrorException,
  toSerializable: (value) => value.error,
  fromSerializable: (value) =>
    new ApiErrorException(ApiErrorSchema.parse(value)),
});
