# Unpublished evidence package queue

This durable queue on the audit branch retains bounded evidence packages after collection, routing, attribution, and document enrichment succeed. It is operational audit data and never changes public data, a score, or publication status.

Each current package is the input for the two independent assessors. A changed package supersedes the prior version for that promise; both remain auditable. A package blocked by an enrichment warning waits until the official document issue is resolved. A package citing evidence that the current attribution rule no longer accepts is retired.
