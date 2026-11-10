# Application entry points

Next.js mounts the workbench here and serves the workspace API and Buffer OAuth endpoints.

Keep this layer thin. Domain rules belong in [`domain`](../domain/README.md). Provider calls and authorization belong on the [server](../server/README.md).
