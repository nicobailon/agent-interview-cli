import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface InterviewConfig {
	timeout?: number;
	theme?: string;
	mode?: "auto" | "light" | "dark";
	port?: number;
	browser?: string;
	snapshotDir?: string;
	autoSave?: boolean;
	toggleHotkey?: string;
	lightPath?: string;
	darkPath?: string;
}

export function xdgConfig(): string {
	return process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
}

export function xdgData(): string {
	return process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
}

export function xdgState(): string {
	return process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
}

export function sessionsPath(): string {
	return join(xdgState(), "interview", "sessions.json");
}

export function recoveryDir(): string {
	return join(xdgState(), "interview", "recovery");
}

export function snapshotsDir(): string {
	return join(xdgData(), "interview", "snapshots");
}

export function configPath(): string {
	return process.env.INTERVIEW_CONFIG || join(xdgConfig(), "interview", "config.json");
}

export function loadConfig(): InterviewConfig {
	try {
		const data = JSON.parse(readFileSync(configPath(), "utf-8"));
		return data as InterviewConfig;
	} catch {
		return {};
	}
}

function parseEnvInt(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const n = parseInt(value, 10);
	return isNaN(n) ? undefined : n;
}

export function resolveConfig(
	cliFlags: Partial<InterviewConfig>,
	fileConfig?: InterviewConfig
): InterviewConfig {
	const file = fileConfig ?? loadConfig();

	const envTimeout = parseEnvInt(process.env.INTERVIEW_TIMEOUT);
	const envPort = parseEnvInt(process.env.INTERVIEW_PORT);

	return {
		timeout: cliFlags.timeout ?? envTimeout ?? file.timeout,
		theme: cliFlags.theme ?? process.env.INTERVIEW_THEME ?? file.theme,
		mode: cliFlags.mode ?? (process.env.INTERVIEW_MODE as InterviewConfig["mode"]) ?? file.mode,
		port: cliFlags.port ?? envPort ?? file.port,
		browser: cliFlags.browser ?? file.browser,
		snapshotDir: cliFlags.snapshotDir ?? file.snapshotDir,
		autoSave: cliFlags.autoSave ?? file.autoSave,
		toggleHotkey: cliFlags.toggleHotkey ?? file.toggleHotkey,
		lightPath: cliFlags.lightPath ?? file.lightPath,
		darkPath: cliFlags.darkPath ?? file.darkPath,
	};
}
