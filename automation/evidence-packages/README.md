# Unpublished evidence package queue

This durable queue on the audit branch retains bounded evidence packages after collection, routing, attribution, and document enrichment succeed. It is operational audit data and never changes public data, a score, or publication status.

Each current package is the input for the two independent assessors. A changed package supersedes the prior version for that promise, and a promise that no longer gets a package has its current package withdrawn; every version remains auditable. A package with an enrichment warning is not assessed until a later run enriches it.
