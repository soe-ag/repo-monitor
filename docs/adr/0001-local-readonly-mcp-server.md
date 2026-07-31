# ADR 0001: Local read-only MCP server

## Status

Accepted

## Decision

Repo Monitor will expose a standalone, local MCP server over stdio. The server will call existing read-only Convex queries and will not add an HTTP transport, authentication system, schema changes, or mutating tools in the first version.

The server uses human-facing repository full names rather than Convex document IDs, projects responses to safe domain data, and writes diagnostics to stderr so stdout remains the MCP JSON-RPC channel.

## Rationale

Stdio is the smallest useful MCP integration for learning because an MCP client can spawn the server without public networking or deployment concerns. Reusing the existing dashboard query avoids duplicating health logic and keeps this experiment independent from the Next.js and Convex runtimes.

## Consequences

The first version is intentionally single-user and depends on the configured Convex deployment. HTTP exposure, authentication, write tools, and multi-connection authorization remain future decisions.
