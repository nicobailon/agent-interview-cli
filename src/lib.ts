import { randomUUID } from "node:crypto";
import {
	startInterviewServer,
	getActiveSessions,
	type ResponseItem,
	type InterviewServerOptions,
	type InterviewServerHandle,
	type InterviewServerCallbacks,
	type InterviewThemeConfig,
} from "./server.js";
import { validateQuestions, type QuestionsFile, type Question, type MediaBlock, type CodeBlock, type OptionValue } from "./schema.js";
import { loadQuestions, mergeThemeConfig, expandHome, type ThemeInput, type SavedQuestionsFile } from "./loader.js";
import { openUrl } from "./browser.js";

export type InterviewStatus = "completed" | "cancelled" | "timeout" | "aborted";

export interface InterviewResult {
	status: InterviewStatus;
	responses: ResponseItem[];
	url: string;
}

export interface QueuedInfo {
	existingSession: { id: string; title: string; cwd: string; gitBranch: string | null; startedAt: number };
	url: string;
}

export interface InterviewOptions {
	questions?: QuestionsFile;
	questionsPath?: string;
	timeout?: number;
	theme?: ThemeInput;
	port?: number;
	open?: boolean;
	browser?: string;
	snapshotDir?: string;
	autoSave?: boolean;
	savedAnswers?: ResponseItem[];
	cwd?: string;
	signal?: AbortSignal;
	verbose?: boolean;
	onReady?: (url: string) => void;
	onQueued?: (info: QueuedInfo) => void;
}

export async function interview(options: InterviewOptions): Promise<InterviewResult> {
	const cwd = options.cwd ?? process.cwd();
	const timeoutSeconds = options.timeout ?? 600;
	const shouldOpen = options.open !== false;

	let questionsData: QuestionsFile;
	let loadedSavedAnswers: ResponseItem[] | undefined;
	if (options.questions) {
		questionsData = validateQuestions(options.questions);
	} else if (options.questionsPath) {
		const loaded = loadQuestions(options.questionsPath, cwd);
		questionsData = loaded;
		loadedSavedAnswers = loaded.savedAnswers;
	} else {
		throw new Error("Either questions or questionsPath is required");
	}

	const themeConfig = mergeThemeConfig(options.theme, cwd);
	const snapshotDir = options.snapshotDir ? expandHome(options.snapshotDir) : undefined;
	const sessionId = randomUUID();
	const sessionToken = randomUUID();

	if (options.signal?.aborted) {
		return { status: "aborted", responses: [], url: "" };
	}

	let server: InterviewServerHandle | null = null;
	let resolved = false;
	let url = "";

	const cleanup = () => {
		if (server) {
			server.close();
			server = null;
		}
	};

	return new Promise<InterviewResult>((resolve, reject) => {
		const handleAbort = () => finish("aborted");

		const finish = (
			status: InterviewStatus,
			responses: ResponseItem[] = [],
		) => {
			if (resolved) return;
			resolved = true;
			options.signal?.removeEventListener("abort", handleAbort);
			cleanup();
			resolve({ status, responses, url });
		};

		options.signal?.addEventListener("abort", handleAbort, { once: true });

		startInterviewServer(
			{
				questions: questionsData,
				sessionToken,
				sessionId,
				cwd,
				timeout: timeoutSeconds,
				port: options.port,
				verbose: options.verbose,
				theme: themeConfig,
				snapshotDir,
				autoSaveOnSubmit: options.autoSave ?? true,
				savedAnswers: options.savedAnswers ?? loadedSavedAnswers,
			},
			{
				onSubmit: (responses) => finish("completed", responses),
				onCancel: (reason, partialResponses) =>
					reason === "timeout"
						? finish("timeout", partialResponses ?? [])
						: finish("cancelled", partialResponses ?? []),
			}
		)
			.then(async (handle) => {
				if (resolved) {
					handle.close();
					return;
				}
				server = handle;
				url = handle.url;

				options.onReady?.(url);

				const activeSessions = getActiveSessions();
				const otherActive = activeSessions.filter((s) => s.id !== sessionId);

				if (otherActive.length > 0) {
					const active = otherActive[0];
					options.onQueued?.({
						existingSession: {
							id: active.id,
							title: active.title,
							cwd: active.cwd,
							gitBranch: active.gitBranch,
							startedAt: active.startedAt,
						},
						url,
					});
				} else if (shouldOpen) {
					try {
						await openUrl(url, options.browser);
					} catch (err) {
						cleanup();
						const message = err instanceof Error ? err.message : String(err);
						reject(new Error(`Failed to open browser: ${message}`));
						return;
					}
				}
			})
			.catch((err) => {
				cleanup();
				reject(err);
			});
	});
}

export {
	validateQuestions,
	startInterviewServer,
	getActiveSessions,
	loadQuestions,
	type ResponseItem,
	type InterviewServerOptions,
	type InterviewServerCallbacks,
	type InterviewServerHandle,
	type InterviewThemeConfig,
	type QuestionsFile,
	type Question,
	type MediaBlock,
	type CodeBlock,
	type OptionValue,
	type ThemeInput,
	type SavedQuestionsFile,
};
