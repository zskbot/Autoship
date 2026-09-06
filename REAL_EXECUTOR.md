# Real executor

`src/runner/real-executor.mjs` contains the production execution primitives for cloning a repository and running dependency installation, tests, and the configured build command.

The executor intentionally does not expose an unauthenticated HTTP endpoint by itself. A deployment service must authenticate the caller, validate the project configuration, and run the executor in an isolated runner with appropriate filesystem/network permissions.

Supported primitive flow:

1. Clone the selected branch with a shallow Git clone.
2. Install dependencies with `npm ci`.
3. Run `npm test --if-present`.
4. Run the project's configured build command.
5. Return the workspace to the caller for a target-specific deployment step.

Before enabling arbitrary public projects, add an isolated runner/container, resource/time limits, command allow-listing, and secret redaction.
