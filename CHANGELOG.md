# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-02-16

Initial release. Ported from `pi-interview` (a pi-agent extension) into a standalone CLI and library with zero runtime dependencies.

### Added

- CLI with JSON-to-stdout / status-to-stderr separation for clean piping
- Library API (`interview()`) with `onReady`, `onQueued` callbacks and `AbortSignal` support
- Five question types: `single`, `multi`, `text`, `image`, `info`
- Rich options with inline code snippets
- Media blocks: images, tables, mermaid diagrams, charts, raw HTML
- Recommendation system with `conviction` (strong/slight) and `weight` (critical/minor)
- Two built-in themes: `default`, `tufte` (light/dark modes, custom CSS paths)
- Self-contained HTML snapshot saving on submit
- Reload saved snapshots to review or continue previous interviews
- Stdin support (`--stdin`) for piping questions from other programs
- XDG-compliant storage paths (state, data, config)
- Session coordination — concurrent interviews share a registry, second session fires `onQueued`
- Heartbeat watchdog detects abandoned browser tabs
- Recovery file saving for stale/cancelled sessions
- Config file support (`~/.config/interview/config.json`) with env var overrides
- Cross-platform browser opening (macOS, Linux, Windows)
- AGENTS.md for agent discovery
- Skill reference at `skills/agent-interview-cli/SKILL.md` for on-demand loading
- 107 tests (80 schema, 12 CLI, 15 library)
