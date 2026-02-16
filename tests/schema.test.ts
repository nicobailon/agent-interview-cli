import { describe, it, expect } from "vitest";
import { validateQuestions, getOptionLabel, isRichOption } from "../src/schema.js";

function valid(overrides: Record<string, unknown> = {}) {
	return {
		questions: [
			{ id: "q1", type: "single", question: "Pick one?", options: ["A", "B"], ...overrides },
		],
	};
}

function validMulti(overrides: Record<string, unknown> = {}) {
	return {
		questions: [
			{ id: "q1", type: "multi", question: "Pick many?", options: ["X", "Y", "Z"], ...overrides },
		],
	};
}

describe("validateQuestions", () => {
	describe("happy path", () => {
		it("accepts minimal single-select", () => {
			const result = validateQuestions(valid());
			expect(result.questions).toHaveLength(1);
			expect(result.questions[0].type).toBe("single");
		});

		it("accepts multi-select", () => {
			const result = validateQuestions(validMulti());
			expect(result.questions[0].type).toBe("multi");
		});

		it("accepts text question", () => {
			const result = validateQuestions({
				questions: [{ id: "q1", type: "text", question: "Describe?" }],
			});
			expect(result.questions[0].type).toBe("text");
		});

		it("accepts image question", () => {
			const result = validateQuestions({
				questions: [{ id: "q1", type: "image", question: "Upload?" }],
			});
			expect(result.questions[0].type).toBe("image");
		});

		it("accepts info question", () => {
			const result = validateQuestions({
				questions: [{ id: "q1", type: "info", question: "Context here" }],
			});
			expect(result.questions[0].type).toBe("info");
		});

		it("accepts title and description", () => {
			const result = validateQuestions({
				title: "My Form",
				description: "Please answer",
				questions: [{ id: "q1", type: "text", question: "Name?" }],
			});
			expect(result.title).toBe("My Form");
			expect(result.description).toBe("Please answer");
		});

		it("accepts mixed question types", () => {
			const result = validateQuestions({
				questions: [
					{ id: "q1", type: "single", question: "Pick?", options: ["A", "B"] },
					{ id: "q2", type: "multi", question: "Select?", options: ["X", "Y"] },
					{ id: "q3", type: "text", question: "Describe?" },
					{ id: "q4", type: "image", question: "Upload?" },
					{ id: "q5", type: "info", question: "Note" },
				],
			});
			expect(result.questions).toHaveLength(5);
		});
	});

	describe("root structure", () => {
		it("rejects array at root", () => {
			expect(() => validateQuestions([{ id: "q1" }])).toThrow("not an array");
		});

		it("rejects null", () => {
			expect(() => validateQuestions(null)).toThrow("must be an object");
		});

		it("rejects string", () => {
			expect(() => validateQuestions("hello")).toThrow("must be an object");
		});

		it("rejects missing questions array", () => {
			expect(() => validateQuestions({ title: "Test" })).toThrow("non-empty array");
		});

		it("rejects empty questions array", () => {
			expect(() => validateQuestions({ questions: [] })).toThrow("non-empty array");
		});

		it("hints when label/description present but questions missing", () => {
			expect(() => validateQuestions({ label: "Test", description: "Hi" })).toThrow(
				"Did you mean to wrap"
			);
		});

		it("rejects non-string title", () => {
			expect(() => validateQuestions({
				title: 123,
				questions: [{ id: "q1", type: "text", question: "?" }],
			})).toThrow("title must be a string");
		});

		it("rejects non-string description", () => {
			expect(() => validateQuestions({
				description: true,
				questions: [{ id: "q1", type: "text", question: "?" }],
			})).toThrow("description must be a string");
		});
	});

	describe("question field validation", () => {
		it("rejects missing id", () => {
			expect(() =>
				validateQuestions({ questions: [{ type: "text", question: "?" }] })
			).toThrow("id must be a string");
		});

		it("rejects invalid type", () => {
			expect(() =>
				validateQuestions({ questions: [{ id: "q1", type: "dropdown", question: "?" }] })
			).toThrow("type must be one of");
		});

		it("hints select → single", () => {
			expect(() =>
				validateQuestions({ questions: [{ id: "q1", type: "select", question: "?" }] })
			).toThrow('use "single"');
		});

		it("rejects missing question text", () => {
			expect(() =>
				validateQuestions({ questions: [{ id: "q1", type: "text" }] })
			).toThrow('"question" field must be a string');
		});

		it("hints label → question", () => {
			expect(() =>
				validateQuestions({ questions: [{ id: "q1", type: "text", label: "Name?" }] })
			).toThrow('use "question" field');
		});

		it("rejects non-string context", () => {
			expect(() => validateQuestions(valid({ context: 123 }))).toThrow(
				"context must be a string"
			);
		});

		it("rejects duplicate ids", () => {
			expect(() =>
				validateQuestions({
					questions: [
						{ id: "q1", type: "text", question: "A?" },
						{ id: "q1", type: "text", question: "B?" },
					],
				})
			).toThrow('Duplicate question id: "q1"');
		});
	});

	describe("options", () => {
		it("requires options for single-select", () => {
			expect(() =>
				validateQuestions({ questions: [{ id: "q1", type: "single", question: "?" }] })
			).toThrow("options required");
		});

		it("requires options for multi-select", () => {
			expect(() =>
				validateQuestions({ questions: [{ id: "q1", type: "multi", question: "?" }] })
			).toThrow("options required");
		});

		it("rejects options on text", () => {
			expect(() => validateQuestions({
				questions: [{ id: "q1", type: "text", question: "?", options: ["A"] }],
			})).toThrow("options not allowed");
		});

		it("rejects options on image", () => {
			expect(() => validateQuestions({
				questions: [{ id: "q1", type: "image", question: "?", options: ["A"] }],
			})).toThrow("options not allowed");
		});

		it("rejects options on info", () => {
			expect(() => validateQuestions({
				questions: [{ id: "q1", type: "info", question: "?", options: ["A"] }],
			})).toThrow("options not allowed");
		});

		it("rejects empty options array", () => {
			expect(() => validateQuestions(valid({ options: [] }))).toThrow(
				"non-empty array"
			);
		});

		it("accepts rich options with label and code", () => {
			const result = validateQuestions(valid({
				options: [
					{ label: "A", code: { code: "const a = 1;" } },
					{ label: "B" },
				],
			}));
			expect(result.questions[0].options).toHaveLength(2);
		});

		it("rejects rich option without label", () => {
			expect(() => validateQuestions(valid({ options: [{ code: "x" }] }))).toThrow(
				'must have a "label" string'
			);
		});

		it("rejects non-string non-object option", () => {
			expect(() => validateQuestions(valid({ options: [42] }))).toThrow(
				"must be a string or object"
			);
		});
	});

	describe("recommended", () => {
		it("accepts recommended for single-select", () => {
			const result = validateQuestions(valid({ recommended: "A" }));
			expect(result.questions[0].recommended).toBe("A");
		});

		it("accepts recommended array for multi-select", () => {
			const result = validateQuestions(validMulti({ recommended: ["X", "Z"] }));
			expect(result.questions[0].recommended).toEqual(["X", "Z"]);
		});

		it("wraps single recommended string in array for multi", () => {
			const result = validateQuestions(validMulti({ recommended: "X" }));
			expect(result.questions[0].recommended).toEqual(["X"]);
		});

		it("rejects recommended not in options for single", () => {
			expect(() => validateQuestions(valid({ recommended: "C" }))).toThrow(
				'recommended "C" not in options'
			);
		});

		it("rejects recommended not in options for multi", () => {
			expect(() => validateQuestions(validMulti({ recommended: ["X", "W"] }))).toThrow(
				'recommended "W" not in options'
			);
		});

		it("rejects recommended on text", () => {
			expect(() => validateQuestions({
				questions: [{ id: "q1", type: "text", question: "?", recommended: "A" }],
			})).toThrow("recommended not allowed");
		});

		it("rejects recommended on image", () => {
			expect(() => validateQuestions({
				questions: [{ id: "q1", type: "image", question: "?", recommended: "A" }],
			})).toThrow("recommended not allowed");
		});

		it("rejects recommended on info", () => {
			expect(() => validateQuestions({
				questions: [{ id: "q1", type: "info", question: "?", recommended: "A" }],
			})).toThrow("recommended not allowed");
		});

		it("rejects non-string recommended for single", () => {
			expect(() => validateQuestions(valid({ recommended: ["A", "B"] }))).toThrow(
				"recommended must be string for single-select"
			);
		});
	});

	describe("conviction", () => {
		it("accepts strong conviction with recommended", () => {
			const result = validateQuestions(valid({ recommended: "A", conviction: "strong" }));
			expect(result.questions[0].conviction).toBe("strong");
		});

		it("accepts slight conviction with recommended", () => {
			const result = validateQuestions(valid({ recommended: "A", conviction: "slight" }));
			expect(result.questions[0].conviction).toBe("slight");
		});

		it("rejects conviction without recommended", () => {
			expect(() => validateQuestions(valid({ conviction: "strong" }))).toThrow(
				"conviction requires recommended"
			);
		});

		it("rejects invalid conviction value", () => {
			expect(() => validateQuestions(valid({ recommended: "A", conviction: "high" }))).toThrow(
				'conviction must be "strong" or "slight"'
			);
		});

		it("rejects non-string conviction", () => {
			expect(() => validateQuestions(valid({ recommended: "A", conviction: true }))).toThrow(
				'conviction must be "strong" or "slight"'
			);
		});
	});

	describe("weight", () => {
		it("accepts critical weight", () => {
			const result = validateQuestions(valid({ weight: "critical" }));
			expect(result.questions[0].weight).toBe("critical");
		});

		it("accepts minor weight", () => {
			const result = validateQuestions(valid({ weight: "minor" }));
			expect(result.questions[0].weight).toBe("minor");
		});

		it("rejects invalid weight value", () => {
			expect(() => validateQuestions(valid({ weight: "high" }))).toThrow(
				'weight must be "critical" or "minor"'
			);
		});

		it("rejects non-string weight", () => {
			expect(() => validateQuestions(valid({ weight: 1 }))).toThrow(
				'weight must be "critical" or "minor"'
			);
		});
	});

	describe("media", () => {
		it("accepts image media", () => {
			const result = validateQuestions(valid({ media: { type: "image", src: "/test.png" } }));
			expect(result.questions[0].media).toBeDefined();
		});

		it("accepts table media", () => {
			const result = validateQuestions(valid({
				media: { type: "table", table: { headers: ["A"], rows: [["1"]] } },
			}));
			expect(result.questions[0].media).toBeDefined();
		});

		it("accepts mermaid media", () => {
			const result = validateQuestions(valid({
				media: { type: "mermaid", mermaid: "graph LR\n  A-->B" },
			}));
			expect(result.questions[0].media).toBeDefined();
		});

		it("accepts chart media", () => {
			const result = validateQuestions(valid({
				media: {
					type: "chart",
					chart: { type: "bar", data: { labels: ["A"], datasets: [] } },
				},
			}));
			expect(result.questions[0].media).toBeDefined();
		});

		it("accepts html media", () => {
			const result = validateQuestions(valid({
				media: { type: "html", html: "<p>Hello</p>" },
			}));
			expect(result.questions[0].media).toBeDefined();
		});

		it("accepts media array", () => {
			const result = validateQuestions(valid({
				media: [
					{ type: "image", src: "/a.png" },
					{ type: "mermaid", mermaid: "graph LR\n  A-->B" },
				],
			}));
			expect(Array.isArray(result.questions[0].media)).toBe(true);
		});

		it("accepts position field", () => {
			const result = validateQuestions(valid({
				media: { type: "image", src: "/a.png", position: "side" },
			}));
			expect(result.questions[0].media).toBeDefined();
		});

		it("rejects invalid media type", () => {
			expect(() => validateQuestions(valid({ media: { type: "video" } }))).toThrow(
				"media.type must be one of"
			);
		});

		it("rejects image without src", () => {
			expect(() => validateQuestions(valid({ media: { type: "image" } }))).toThrow(
				"media.src required"
			);
		});

		it("rejects chart without chart object", () => {
			expect(() => validateQuestions(valid({ media: { type: "chart" } }))).toThrow(
				"media.chart required"
			);
		});

		it("rejects chart without chart.type", () => {
			expect(() => validateQuestions(valid({
				media: { type: "chart", chart: { data: {} } },
			}))).toThrow("media.chart.type must be a string");
		});

		it("rejects chart without chart.data", () => {
			expect(() => validateQuestions(valid({
				media: { type: "chart", chart: { type: "bar" } },
			}))).toThrow("media.chart.data must be an object");
		});

		it("rejects mermaid without string", () => {
			expect(() => validateQuestions(valid({ media: { type: "mermaid" } }))).toThrow(
				"media.mermaid required"
			);
		});

		it("rejects table without table object", () => {
			expect(() => validateQuestions(valid({ media: { type: "table" } }))).toThrow(
				"media.table required"
			);
		});

		it("rejects table without headers", () => {
			expect(() => validateQuestions(valid({
				media: { type: "table", table: { rows: [] } },
			}))).toThrow("media.table.headers must be an array");
		});

		it("rejects table without rows", () => {
			expect(() => validateQuestions(valid({
				media: { type: "table", table: { headers: ["A"] } },
			}))).toThrow("media.table.rows must be an array");
		});

		it("rejects html without string", () => {
			expect(() => validateQuestions(valid({ media: { type: "html" } }))).toThrow(
				"media.html required"
			);
		});

		it("rejects invalid position", () => {
			expect(() => validateQuestions(valid({
				media: { type: "image", src: "/a.png", position: "left" },
			}))).toThrow("media.position must be one of");
		});

		it("rejects non-object media", () => {
			expect(() => validateQuestions(valid({ media: "image" }))).toThrow(
				"media must be an object"
			);
		});
	});

	describe("codeBlock", () => {
		it("accepts valid codeBlock", () => {
			const result = validateQuestions(valid({
				codeBlock: { code: "const x = 1;", lang: "ts" },
			}));
			expect(result.questions[0].codeBlock?.code).toBe("const x = 1;");
		});

		it("rejects codeBlock without code", () => {
			expect(() => validateQuestions(valid({ codeBlock: { lang: "ts" } }))).toThrow(
				"codeBlock.code must be a string"
			);
		});

		it("rejects non-string codeBlock.lang", () => {
			expect(() => validateQuestions(valid({ codeBlock: { code: "x", lang: 42 } }))).toThrow(
				"codeBlock.lang must be a string"
			);
		});

		it("accepts codeBlock with highlights", () => {
			const result = validateQuestions(valid({
				codeBlock: { code: "a\nb\nc", highlights: [1, 3] },
			}));
			expect(result.questions[0].codeBlock?.highlights).toEqual([1, 3]);
		});

		it("rejects non-number highlights", () => {
			expect(() => validateQuestions(valid({
				codeBlock: { code: "x", highlights: ["a"] },
			}))).toThrow("highlights must be an array of numbers");
		});
	});

	describe("combinations", () => {
		it("accepts critical info with media", () => {
			const result = validateQuestions({
				questions: [{
					id: "q1", type: "info", question: "Architecture",
					weight: "critical",
					media: { type: "mermaid", mermaid: "graph LR\n  A-->B" },
				}],
			});
			expect(result.questions[0].weight).toBe("critical");
		});

		it("accepts minor single with recommended and slight conviction", () => {
			const result = validateQuestions(valid({
				weight: "minor", recommended: "A", conviction: "slight",
			}));
			expect(result.questions[0].weight).toBe("minor");
			expect(result.questions[0].conviction).toBe("slight");
		});

		it("accepts all features together", () => {
			const result = validateQuestions({
				title: "Full Test",
				description: "Every feature",
				questions: [{
					id: "q1", type: "multi", question: "Pick?",
					options: [{ label: "A", code: { code: "a()" } }, "B", "C"],
					recommended: ["A", "C"],
					conviction: "strong",
					weight: "critical",
					context: "Choose wisely",
					codeBlock: { code: "example()", lang: "ts" },
					media: [
						{ type: "table", table: { headers: ["X"], rows: [["1"]], highlights: [0] }, position: "side" },
						{ type: "image", src: "/test.png", alt: "test", caption: "Figure 1" },
					],
				}],
			});
			expect(result.questions[0].options).toHaveLength(3);
			expect(result.questions[0].recommended).toEqual(["A", "C"]);
		});
	});
});

describe("getOptionLabel", () => {
	it("returns string option as-is", () => {
		expect(getOptionLabel("hello")).toBe("hello");
	});

	it("returns label from rich option", () => {
		expect(getOptionLabel({ label: "test", code: { code: "x" } })).toBe("test");
	});
});

describe("isRichOption", () => {
	it("returns false for string", () => {
		expect(isRichOption("hello")).toBe(false);
	});

	it("returns true for object with label", () => {
		expect(isRichOption({ label: "test" })).toBe(true);
	});
});
