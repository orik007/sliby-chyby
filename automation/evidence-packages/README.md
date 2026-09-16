# Unpublished evidence package queue

This durable queue retains bounded evidence packages after collection, matching, and document enrichment succeed. It is operational audit data and never changes public data, a score, or publication status.

Each current package is the input for the two independent assessors. A changed package supersedes the prior queued version for that promise; both files remain auditable. Enrichment warnings remain attached to the queued package and block assessment until the official document issue is resolved.
