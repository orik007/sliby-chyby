# Cloudflare infrastructure

This document records how SlibyChyby resources are separated within the shared Cloudflare account.

## Confirmed decisions

- Treat each Cloudflare Worker as one deployable application. Do not create a separate Cloudflare account for every project.
- Group resources with Cloudflare resource tags and a consistent name prefix. Cloudflare resource tagging is currently a public-beta feature, so names remain meaningful even when tags are unavailable in a particular view.
- Use `sliby-chyby` as the project prefix. Future resources for this product must use `sliby-chyby-*` unless a provider-controlled identifier prevents it.
- Use a neutral account-wide Workers subdomain, `orik007-apps.workers.dev`, because the namespace can host future unrelated Workers as well.
- Use one production Worker named `sliby-chyby` for the public web application. A separate staging Worker may be added only after a concrete need appears.
- Apply these tags to the production Worker:

  - `project=sliby-chyby`
  - `component=public-web`
  - `environment=production`
  - `managed_by=workers-builds`
  - `repository=orik007/sliby-chyby`

- Keep deployment configuration in the repository through `wrangler.deploy.jsonc`. The non-default filename prevents the generated server entry point from being treated as a source entry point during the Astro build. Do not store Cloudflare credentials or build tokens in the repository.
- Configure one Workers Builds production trigger for `main`. Do not configure a non-production trigger; unpublished review branches must not receive public preview URLs.
- Run `npm run build` before `npx wrangler deploy --config wrangler.deploy.jsonc`. The Worker name in Cloudflare and `wrangler.deploy.jsonc` must remain identical.
- Keep the existing ChatGPT Sites deployment recorded as the temporary fallback during the name and domain transition. Removing it requires an explicit cleanup decision.

## Current resources

| Resource | Identifier | Purpose |
| --- | --- | --- |
| Workers account subdomain | `orik007-apps.workers.dev` | Shared neutral namespace for present and future Workers |
| Production Worker | `sliby-chyby` | Public SlibyChyby website |
| Temporary fallback | `sliby-chyby-demo.sorastars.chatgpt.site` | Earlier public deployment retained during migration |

The first repository-triggered Workers Build from `main` completed successfully on 2026-09-03. The production Worker now serves the Astro application directly. The fallback remains available until the final name and domain migration is complete.

## Resource-creation rules

- Create a dedicated resource only when the application needs it; do not pre-create databases, buckets, queues, or staging services.
- Give every new resource the `project`, `component`, `environment`, `managed_by`, and `repository` tags where the resource type supports tagging.
- Separate production and staging with distinct resource names and `environment` tags. Do not use one production binding as an implicit staging resource.
- Prefer provider-managed build credentials. If a manual token becomes necessary, store it only in the relevant hosted secret store with the narrowest practical scope.

## Open questions

- The final public product name and custom domain.
- Whether a dedicated staging Worker becomes useful after the real publication workflow is complete.
- How Cloudflare deployment success or failure will be reported automatically in the mobile approval conversation.
