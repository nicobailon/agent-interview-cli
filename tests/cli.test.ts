import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, "..", "bin", "interview.mjs");
const FIXTURES = join(__dirname, "test-questions.json");

function run(args: string[], options?: { stdin?: string; timeout?: number }): Promise<{
	stdout: string;
	stderr: string;
	code: number | null;
}> {
	return new Promise((resolve) => {
		const proc = execFile("node", [BIN, ...args], {
			timeout: options?.timeout ?? 5000,
			cwd: __dirname,
		}, (err, stdout, stderr) => {
			resolve({
				stdout: stdout ?? "",
				stderr: stderr ?? "",
				code: proc.exitCode,
			});
		});
		if (options?.stdin !== undefined) {
			proc.stdin?.write(options.stdin);
			proc.stdin?.end();
		}
	});
}

describe("CLI", () => {
	describe("help and version", () => {
		it("--help prints usage and exits 0", async () => {
			const { stdout, code } = await run(["--help"]);
			expect(code).toBe(0);
			expect(stdout).toContain("Usage: interview");
			expect(stdout).toContain("--timeout");
			expect(stdout).toContain("--stdin");
		});

		it("-h is an alias for --help", async () => {
			const { stdout, code } = await run(["-h"]);
			expect(code).toBe(0);
			expect(stdout).toContain("Usage: interview");
		});

		it("--version prints version and exits 0", async () => {
			const { stdout, code } = await run(["--version"]);
			expect(code).toBe(0);
			expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
		});

		it("-V is an alias for --version", async () => {
			const { stdout, code } = await run(["-V"]);
			expect(code).toBe(0);
			expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
		});
	});

	describe("argument validation", () => {
		it("exits 2 with no arguments", async () => {
			const { stderr, code } = await run([]);
			expect(code).toBe(2);
			expect(stderr).toContain("Missing questions file");
		});

		it("exits 2 with nonexistent file", async () => {
			const { stderr, code } = await run(["nonexistent.json"]);
			expect(code).toBe(2);
			expect(stderr).toContain("not found");
		});

		it("exits 2 when --stdin and file path both provided", async () => {
			const { stderr, code } = await run(["--stdin", "file.json"]);
			expect(code).toBe(2);
			expect(stderr).toContain("Cannot use both");
		});

		it("exits 2 with invalid --timeout", async () => {
			const { stderr, code } = await run(["--timeout", "abc", FIXTURES]);
			expect(code).toBe(2);
			expect(stderr).toContain("positive number");
		});

		it("exits 2 with invalid --port", async () => {
			const { stderr, code } = await run(["--port", "99999", FIXTURES]);
			expect(code).toBe(2);
			expect(stderr).toContain("between 1 and 65535");
		});

		it("exits 2 with unknown option", async () => {
			const { stderr, code } = await run(["--bogus"]);
			expect(code).toBe(2);
			expect(stderr).toContain("Error");
		});
	});

	describe("stdin", () => {
		it("exits 2 with invalid JSON on stdin", async () => {
			const { stderr, code } = await run(["--stdin"], { stdin: "not json" });
			expect(code).toBe(2);
			expect(stderr).toContain("Invalid JSON from stdin");
		});

		it("exits 2 with invalid questions schema on stdin", async () => {
			const { stderr, code } = await run(["--stdin"], { stdin: '{"title":"test"}' });
			expect(code).toBe(2);
			expect(stderr).toContain("non-empty array");
		});
	});
});
