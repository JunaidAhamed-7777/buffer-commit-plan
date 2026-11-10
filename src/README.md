# Application source

Reserved for Patchwork implementation. This directory contains documentation and empty markers only. No runnable application exists.

- [app](app/README.md): page composition, routes and interactive entry points.
- [components](components/README.md): accessible presentation components.
- [domain](domain/README.md): pure fact binding, patch planning and review rules.
- [server](server/README.md): authorization, Buffer access, durable operations and persistence.

Start with the [development guide](../docs/development/getting-started.md) after implementation is authorized. Keep provider secrets and authorization logic on the server. UI code must not bypass the reviewed operation protocol.
