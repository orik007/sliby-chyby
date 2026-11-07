// The Worker's bindings and secrets, read through the runtime module.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
