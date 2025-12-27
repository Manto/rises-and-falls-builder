/**
 * Safely parse and validate an integer parameter from a Hono request.
 * Returns the parsed integer or throws a Response with 400 status.
 */
export function parseIntParam(param: string, paramName: string = "id"): number {
  const parsed = parseInt(param, 10);

  if (isNaN(parsed) || parsed <= 0) {
    throw new Response(
      JSON.stringify({
        error: `Invalid ${paramName}: must be a positive integer`
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  return parsed;
}

/**
 * Safely parse and validate an optional integer parameter.
 * Returns the parsed integer or null if the param is empty/undefined.
 */
export function parseOptionalIntParam(param: string | undefined, paramName: string = "id"): number | null {
  if (!param || param.trim() === "") {
    return null;
  }

  const parsed = parseInt(param, 10);

  if (isNaN(parsed) || parsed <= 0) {
    throw new Response(
      JSON.stringify({
        error: `Invalid ${paramName}: must be a positive integer`
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  return parsed;
}
