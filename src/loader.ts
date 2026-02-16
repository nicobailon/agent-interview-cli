import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { validateQuestions, type QuestionsFile } from "./schema.js";
import type { ResponseItem } from "./server.js";

interface SavedFromMeta {
	cwd: string;
	branch: string | null;
	sessionId: string;
}

export interface SavedQuestionsFile extends QuestionsFile {
	savedAnswers?: ResponseItem[];
	savedAt?: string;
	wasSubmitted?: boolean;
	savedFrom?: SavedFromMeta;
}

export function expandHome(value: string): string {
	if (value === "~") return os.homedir();
	if (value.startsWith("~/") || value.startsWith("~\\")) {
		return path.join(os.homedir(), value.slice(2));
	}
	return value;
}

function resolveOptionalPath(value: string | undefined, cwd: string): string | undefined {
	if (!value) return undefined;
	const expanded = expandHome(value);
	return path.isAbsolute(expanded) ? expanded : path.join(cwd, expanded);
}

const DEFAULT_THEME_HOTKEY = "mod+shift+l";

export interface ThemeInput {
	mode?: "auto" | "light" | "dark";
	name?: string;
	lightPath?: string;
	darkPath?: string;
	toggleHotkey?: string;
}

export function mergeThemeConfig(
	theme: ThemeInput | undefined,
	cwd: string
): ThemeInput {
	const merged: ThemeInput = { ...(theme ?? {}) };
	return {
		...merged,
		toggleHotkey: merged.toggleHotkey ?? DEFAULT_THEME_HOTKEY,
		lightPath: resolveOptionalPath(merged.lightPath, cwd),
		darkPath: resolveOptionalPath(merged.darkPath, cwd),
	};
}

export function loadQuestions(questionsPath: string, cwd: string): SavedQuestionsFile {
	const expanded = expandHome(questionsPath);
	const absolutePath = path.isAbsolute(expanded)
		? expanded
		: path.join(cwd, questionsPath);

	if (!fs.existsSync(absolutePath)) {
		throw new Error(`Questions file not found: ${absolutePath}`);
	}

	const content = fs.readFileSync(absolutePath, "utf-8");

	if (absolutePath.endsWith(".html") || absolutePath.endsWith(".htm")) {
		return loadSavedInterview(content, absolutePath);
	}

	let data: unknown;
	try {
		data = JSON.parse(content);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Invalid JSON in questions file: ${message}`);
	}

	return validateQuestions(data);
}

function loadSavedInterview(html: string, filePath: string): SavedQuestionsFile {
	const match = html.match(/<script[^>]+id=["']pi-interview-data["'][^>]*>([\s\S]*?)<\/script>/i);
	if (!match) {
		throw new Error("Invalid saved interview: missing embedded data");
	}

	let data: unknown;
	try {
		data = JSON.parse(match[1]);
	} catch {
		throw new Error("Invalid saved interview: malformed JSON");
	}

	const raw = data as Record<string, unknown>;
	const validated = validateQuestions(data);

	const snapshotDir = path.dirname(filePath);
	const savedAnswers = Array.isArray(raw.savedAnswers)
		? resolveAnswerPaths(raw.savedAnswers as ResponseItem[], snapshotDir)
		: undefined;

	let savedFrom: SavedFromMeta | undefined;
	if (raw.savedFrom && typeof raw.savedFrom === "object") {
		const sf = raw.savedFrom as Record<string, unknown>;
		if (typeof sf.cwd === "string" && typeof sf.sessionId === "string") {
			savedFrom = {
				cwd: sf.cwd,
				branch: typeof sf.branch === "string" ? sf.branch : null,
				sessionId: sf.sessionId,
			};
		}
	}

	return {
		...validated,
		savedAnswers,
		savedAt: typeof raw.savedAt === "string" ? raw.savedAt : undefined,
		wasSubmitted: typeof raw.wasSubmitted === "boolean" ? raw.wasSubmitted : undefined,
		savedFrom,
	};
}

function resolveAnswerPaths(answers: ResponseItem[], baseDir: string): ResponseItem[] {
	return answers.map((ans) => ({
		...ans,
		value: resolvePathValue(ans.value, baseDir),
		attachments: ans.attachments?.map((p) => resolveImagePath(p, baseDir)),
	}));
}

function resolveImagePath(p: string, baseDir: string): string {
	if (!p) return p;
	if (p.includes("://")) return p;
	const expanded = expandHome(p);
	if (path.isAbsolute(expanded)) return expanded;
	return path.join(baseDir, p);
}

function resolvePathValue(value: string | string[], baseDir: string): string | string[] {
	if (Array.isArray(value)) {
		return value.map((v) => resolveImagePath(v, baseDir));
	}
	return typeof value === "string" && value ? resolveImagePath(value, baseDir) : value;
}

export function formatTimeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 0) return "just now";
	if (seconds < 60) return `${seconds} seconds ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
	const hours = Math.floor(minutes / 60);
	return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}
