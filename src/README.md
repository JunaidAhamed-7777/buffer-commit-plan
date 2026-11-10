# Application source

Patchwork's application code is organized by the responsibilities below.

- [app](app/README.md): page composition, routes and interactive entry points.
- [components](components/README.md): accessible presentation components.
- [domain](domain/README.md): pure fact binding, patch planning and review rules.
- [server](server/README.md): authorization, Buffer access, durable operations and persistence.

Start with the [development guide](../docs/development/getting-started.md). Keep provider secrets and authorization logic on the server. UI actions go through the reviewed operation protocol.
