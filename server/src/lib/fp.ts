import type { FastifyInstance } from "fastify";

/** Minimal fastify-plugin shim: marks a plugin to skip encapsulation so its
 *  decorators/hooks apply to the parent instance. Avoids an extra dependency. */
export default function fp(
  fn: (app: FastifyInstance, opts: Record<string, unknown>) => Promise<void> | void,
) {
  (fn as unknown as Record<symbol, boolean>)[Symbol.for("skip-override")] = true;
  return fn;
}
