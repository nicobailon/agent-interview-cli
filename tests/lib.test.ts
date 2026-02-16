import { describe, it, expect } from "vitest";
import { interview, validateQuestions, startInterviewServer, getActiveSessions, loadQuestions } from "../src/lib.js";
import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "test-questions.json");

const MINIMAL_QUESTIONS = {
	questions: [{ id: "q1", type: "text" as const, question: "Test?" }],
};

describe("interview()", () => {
	it("requires questions or questionsPath", async () => {
		await expect(interview({})).rejects.toThrow("Either questions or questionsPath is required");
	});

	it("returns aborted when signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		const result = await interview({
			questions: MINIMAL_QUESTIONS,
			signal: controller.signal,
		});
		expect(result.status).toBe("aborted");
		expect(result.responses).toEqual([]);
	});

	it("starts server and returns url with open: false", async () => {
		const controller = new AbortController();

		const promise = interview({
			questions: MINIMAL_QUESTIONS,
			open: false,
			signal: controller.signal,
		});

		await new Promise((r) => setTimeout(r, 300));
		controller.abort();

		const result = await promise;
		expect(result.status).toBe("aborted");
		expect(result.url).toMatch(/^http:\/\/localhost:\d+\/\?session=/);
	});

	it("loads questions from file path", async () => {
		const controller = new AbortController();

		const promise = interview({
			questionsPath: FIXTURES,
			open: false,
			signal: controller.signal,
		});

		await new Promise((r) => setTimeout(r, 300));
		controller.abort();

		const result = await promise;
		expect(result.status).toBe("aborted");
		expect(result.url).toMatch(/^http:\/\/localhost:\d+/);
	});

	it("validates inline questions", async () => {
		await expect(
			interview({ questions: { questions: [] } as any })
		).rejects.toThrow("non-empty array");
	});

	it("health endpoint responds ok", async () => {
		const controller = new AbortController();

		const promise = interview({
			questions: MINIMAL_QUESTIONS,
			open: false,
			signal: controller.signal,
		});

		await new Promise((r) => setTimeout(r, 300));

		const sessions = getActiveSessions();
		const session = sessions[sessions.length - 1];
		if (session) {
			const healthUrl = session.url.replace("/?session=", "/health?session=");
			const resp = await fetch(healthUrl);
			const data = await resp.json();
			expect(data).toEqual({ ok: true });
		}

		controller.abort();
		await promise;
	});

	it("fires onReady with URL when server starts", async () => {
		const controller = new AbortController();
		let readyUrl: string | null = null;

		const promise = interview({
			questions: MINIMAL_QUESTIONS,
			open: false,
			signal: controller.signal,
			onReady: (url) => { readyUrl = url; },
		});

		await new Promise((r) => setTimeout(r, 300));
		expect(readyUrl).not.toBeNull();
		expect(readyUrl).toMatch(/^http:\/\/localhost:\d+\/\?session=/);

		controller.abort();
		const result = await promise;
		expect(result.url).toBe(readyUrl);
	});

	it("cleans up server on early abort", async () => {
		const controller = new AbortController();

		const promise = interview({
			questions: MINIMAL_QUESTIONS,
			open: false,
			signal: controller.signal,
		});

		controller.abort();
		const result = await promise;
		expect(result.status).toBe("aborted");
	});

	it("calls onQueued when another session is active", async () => {
		const controller1 = new AbortController();
		const controller2 = new AbortController();

		const p1 = interview({
			questions: MINIMAL_QUESTIONS,
			open: false,
			signal: controller1.signal,
		});

		await new Promise((r) => setTimeout(r, 300));

		let queuedInfo: any = null;
		const p2 = interview({
			questions: MINIMAL_QUESTIONS,
			open: false,
			signal: controller2.signal,
			onQueued: (info) => { queuedInfo = info; },
		});

		await new Promise((r) => setTimeout(r, 300));

		expect(queuedInfo).not.toBeNull();
		expect(queuedInfo.existingSession).toBeDefined();
		expect(queuedInfo.url).toMatch(/^http:\/\/localhost:\d+/);

		controller1.abort();
		controller2.abort();
		await Promise.all([p1, p2]);
	});
});

describe("startInterviewServer()", () => {
	it("starts and closes cleanly", async () => {
		const token = randomUUID();
		const handle = await startInterviewServer(
			{
				questions: MINIMAL_QUESTIONS,
				sessionToken: token,
				sessionId: randomUUID(),
				cwd: process.cwd(),
				timeout: 60,
			},
			{ onSubmit: () => {}, onCancel: () => {} }
		);

		expect(handle.url).toMatch(/^http:\/\/localhost:\d+/);

		const healthUrl = handle.url.replace("/?session=", "/health?session=");
		const resp = await fetch(healthUrl);
		expect(resp.status).toBe(200);

		handle.close();
	});

	it("serves HTML form", async () => {
		const token = randomUUID();
		const handle = await startInterviewServer(
			{
				questions: MINIMAL_QUESTIONS,
				sessionToken: token,
				sessionId: randomUUID(),
				cwd: process.cwd(),
				timeout: 60,
			},
			{ onSubmit: () => {}, onCancel: () => {} }
		);

		const resp = await fetch(handle.url);
		expect(resp.status).toBe(200);
		expect(resp.headers.get("content-type")).toContain("text/html");

		const html = await resp.text();
		expect(html).toContain("<!DOCTYPE html>");

		handle.close();
	});

	it("rejects invalid session token", async () => {
		const token = randomUUID();
		const handle = await startInterviewServer(
			{
				questions: MINIMAL_QUESTIONS,
				sessionToken: token,
				sessionId: randomUUID(),
				cwd: process.cwd(),
				timeout: 60,
			},
			{ onSubmit: () => {}, onCancel: () => {} }
		);

		const badUrl = handle.url.replace(token, "bad-token");
		const resp = await fetch(badUrl);
		expect(resp.status).toBe(403);

		handle.close();
	});
});

describe("re-exports", () => {
	it("exports validateQuestions", () => {
		expect(typeof validateQuestions).toBe("function");
	});

	it("exports getActiveSessions", () => {
		expect(typeof getActiveSessions).toBe("function");
	});

	it("exports loadQuestions", () => {
		expect(typeof loadQuestions).toBe("function");
	});
});
