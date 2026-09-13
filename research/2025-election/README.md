# 2025 election research

This directory stores campaign sources and non-public promise research for ANO 2011, SPD, and Motoristé sobě in the 2025 Czech Chamber of Deputies election.

A source is one concrete item, such as one PDF, page, post, video, or article. A source may support many promises. Every promise has one source ID and an exact locator within that source.

Every promise is one of three states:

- `candidate`: found but not confirmed;
- `confirmed`: represented by the public promise with the same ID in `data/promises`;
- `rejected`: not admitted to the catalogue, with a reason.

`promises.json` is the campaign-source and promise catalogue. The other files are discovery catalogues; they are not promise catalogues and cannot publish a promise. Exact wording and the original source stay attached to every promise.

`category-audit.md` and `promise-category-audit.json` are non-public source-review artifacts for the common-category mapping in `data/promise-categories.json`. They retain source-section and heading-review work; the public site displays only the common category.

Confirmation follows [promise-selection.md](../../docs/promise-selection.md): it creates the public promise, source, and initial score revision together. No candidate or rejected promise is public or enters the SLAVA Index.
