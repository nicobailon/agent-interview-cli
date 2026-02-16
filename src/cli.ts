import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { interview, type InterviewResult, type QuestionsFile } from "./lib.js";
import { resolveConfig } from "./config.js";
import { formatTimeAgo } from "./loader.js";

function getVersion(): string {
	const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
	try {
		return JSON.parse(readFileSync(pkgPath, "utf-8")).version;
	} catch {
		return "0.0.0";
	}
}

const HELP = `Usage: interview [options] <questions>

Open a web form to gather responses, output JSON to stdout.

Arguments:
  questions              Path to questions JSON or saved interview HTML

Options:
  -t, --timeout <sec>    Timeout in seconds (default: 600)
  --theme <name>         Theme: default, tufte (default: "default")
  --mode <mode>          Theme mode: auto, light, dark (default: "dark")
  --port <port>          Fixed port number
  --no-open              Print URL to stderr, don't open browser
  --browser <cmd>        Browser command (e.g., "firefox", "google-chrome")
  --snapshot-dir <dir>   Save snapshot directory
  --no-save              Don't auto-save on submit
  --stdin                Read questions JSON from stdin
  --pretty               Pretty-print JSON output
  -q, --quiet            Suppress status messages on stderr
  -v, --verbose          Debug logging to stderr
  -V, --version          Show version
  -h, --help             Show help

Environment:
  INTERVIEW_TIMEOUT      Default timeout
  INTERVIEW_THEME        Default theme name
  INTERVIEW_MODE         Default theme mode
  INTERVIEW_PORT         Default port
  INTERVIEW_CONFIG       Config file path override`;

function stderr(msg: string, quiet: boolean) {
	if (!quiet) process.stderr.write(msg + "\n");
}

function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", (chunk) => { data += chunk; });
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
}

async function main() {
	let args;
	try {
		args = parseArgs({
			allowPositionals: true,
			allowNegative: true,
			options: {
				timeout: { type: "string", short: "t" },
				theme: { type: "string" },
				mode: { type: "string" },
				port: { type: "string" },
				open: { type: "boolean", default: true },
				browser: { type: "string" },
				"snapshot-dir": { type: "string" },
				save: { type: "boolean", default: true },
				stdin: { type: "boolean", default: false },
				pretty: { type: "boolean", default: false },
				quiet: { type: "boolean", short: "q", default: false },
				verbose: { type: "boolean", short: "v", default: false },
				version: { type: "boolean", short: "V", default: false },
				help: { type: "boolean", short: "h", default: false },
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: ${message}\n`);
		process.exit(2);
	}

	const { values, positionals } = args;

	if (values.help) {
		console.log(HELP);
		process.exit(0);
	}

	if (values.version) {
		console.log(getVersion());
		process.exit(0);
	}

	const useStdin = values.stdin;
	const questionsPath = positionals[0];

	if (useStdin && questionsPath) {
		process.stderr.write("Error: Cannot use both --stdin and a file path argument\n");
		process.exit(2);
	}

	if (!useStdin && !questionsPath) {
		process.stderr.write("Error: Missing questions file argument. Use --help for usage.\n");
		process.exit(2);
	}

	const quiet = values.quiet as boolean;
	const pretty = values.pretty as boolean;
	const timeout = values.timeout ? parseInt(values.timeout as string, 10) : undefined;
	const port = values.port ? parseInt(values.port as string, 10) : undefined;

	if (timeout !== undefined && (isNaN(timeout) || timeout <= 0)) {
		process.stderr.write("Error: --timeout must be a positive number\n");
		process.exit(2);
	}

	if (port !== undefined && (isNaN(port) || port <= 0 || port > 65535)) {
		process.stderr.write("Error: --port must be between 1 and 65535\n");
		process.exit(2);
	}

	const config = resolveConfig({
		timeout,
		theme: values.theme as string | undefined,
		mode: values.mode as "auto" | "light" | "dark" | undefined,
		port,
		browser: values.browser as string | undefined,
		snapshotDir: values["snapshot-dir"] as string | undefined,
		autoSave: values.save === false ? false : undefined,
	});

	let questionsData: QuestionsFile | undefined;
	if (useStdin) {
		const raw = await readStdin();
		try {
			questionsData = JSON.parse(raw);
		} catch {
			process.stderr.write("Error: Invalid JSON from stdin\n");
			process.exit(2);
		}
	}

	const controller = new AbortController();
	let outputWritten = false;

	const writeResult = (result: InterviewResult) => {
		if (outputWritten) return;
		outputWritten = true;
		const output = {
			status: result.status,
			responses: result.responses,
		};
		const json = pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
		process.stdout.write(json + "\n");
	};

	const handleSignal = () => {
		if (!outputWritten) {
			writeResult({ status: "aborted", responses: [], url: "" });
		}
		controller.abort();
		process.exit(1);
	};

	process.on("SIGINT", handleSignal);
	process.on("SIGTERM", handleSignal);

	try {
		const shouldOpen = values.open as boolean;
		const result = await interview({
			questions: questionsData,
			questionsPath: questionsPath || undefined,
			timeout: config.timeout ?? 600,
			theme: {
				name: config.theme,
				mode: config.mode,
				lightPath: config.lightPath,
				darkPath: config.darkPath,
				toggleHotkey: config.toggleHotkey,
			},
			port: config.port,
			open: shouldOpen,
			browser: config.browser,
			snapshotDir: config.snapshotDir,
			autoSave: config.autoSave ?? true,
			verbose: values.verbose as boolean,
			signal: controller.signal,
			onReady: (url) => {
				if (!shouldOpen) {
					stderr(`Interview URL: ${url}`, quiet);
				}
			},
			onQueued: (info) => {
				stderr(`Interview already active:`, quiet);
				stderr(`  Title: ${info.existingSession.title}`, quiet);
				stderr(`  Project: ${info.existingSession.cwd}`, quiet);
				stderr(`  Started: ${formatTimeAgo(info.existingSession.startedAt)}`, quiet);
				stderr(``, quiet);
				stderr(`New interview queued. Open when ready:`, quiet);
				stderr(`  ${info.url}`, quiet);
			},
		});

		writeResult(result);
		process.exit(result.status === "completed" ? 0 : 1);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Error: ${message}\n`);
		if (!outputWritten) {
			writeResult({ status: "aborted", responses: [], url: "" });
		}
		process.exit(2);
	}
}

main();
