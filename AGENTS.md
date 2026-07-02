You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Repository Boundary

Work requested for `A:\Projects\chmura-blokserwis` must remain in this
repository. Treat `A:\Projects\UniSource` as read-only reference material unless
the user explicitly approves a separate UniSource task.

Without that explicit approval, do not edit files, create branches or commits,
push, merge, reset branches, run release workflows, publish npm packages, or
deploy anything from `A:\Projects\UniSource`.

When a missing UniSource API or SDK contract blocks work, report the exact
contract gap and continue independent chmura-blokserwis tasks. Do not work
around the boundary with local package links.
