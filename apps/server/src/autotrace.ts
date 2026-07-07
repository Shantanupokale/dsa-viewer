import { z } from "zod";
import type { Config } from "./config.js";

/**
 * AI auto-trace: rewrite a raw pasted solution into a full runnable program that uses
 * the dsaviz tracer SDK, via Gemini 2.5 Flash.
 *
 * Trust model: the model's output is UNTRUSTED CODE. It is returned to the client for
 * review and only ever executed inside the Docker sandbox (the same boundary as any
 * user code). It is never evaluated on the server or in the browser.
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const REQUEST_TIMEOUT_MS = 30_000;

export const PLUGINS = ["sequence", "node-link", "table", "heap"] as const;

const ResultSchema = z.object({
  concept: z.string().min(1).max(100),
  plugin: z.enum(PLUGINS),
  code: z.string().min(1).max(60_000),
});
export type AutotraceResult = z.infer<typeof ResultSchema>;

/** Envelope shape of a Gemini generateContent response (the parts we use). */
const GeminiEnvelope = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string() })).min(1),
        }),
      }),
    )
    .min(1),
});

// The tracer API contract the model must target. Kept in one place so SDK additions
// only need a prompt update.
const TRACER_API_GO = `
package tracer (import "dsaviz/tracer"). EXACT signatures — every value type is int,
constructors return POINTERS, nothing returns interface{}:

SEQUENCE
  func NewArray(name string, initial []int) *Array   // POINTER already — never write &arr
    (a *Array) Get(i int) int      // plain int — NEVER a type assertion like .(int)
    (a *Array) Set(i int, v int)
    (a *Array) Swap(i int, j int)
    (a *Array) Len() int
  func NewStack(name string) *Stack        — Push(v int); Pop() int; Peek() int; Empty() bool; Len() int
  func NewQueue(name string) *Queue        — Enqueue(v int); Dequeue() int; Peek() int; Empty() bool; Len() int
  func NewDeque(name string) *Deque        — PushFront/PushBack(v int); PopFront/PopBack() int; Front/Back() int; Empty() bool; Len() int
  func NewString(name string, s string) *TracedString — At(i int) byte; Compare(i, j int) bool; Len() int

LINKED LIST — node ids are strings
  func NewLinkedList(name string) *LinkedList
    NewNode(value int) string; SetNext(nodeID string, targetID string) // "" means nil
    NextOf(nodeID string) string; Visit(nodeID string)

TREE / GRAPH
  func NewTree(name string) *Graph   // hierarchical layout
  func NewGraph(name string) *Graph  // force layout
    AddNode(id string, value int); AddVertex(id string); AddEdge(from, to string)
    Visit(id string); TraverseEdge(from, to string)

DP TABLE
  func NewDPTable(name string, rows, cols int) *DPTable
    Get(r, c int) int; Set(r, c, v int)
    SetWithDeps(r, c, v int, deps []tracer.Cell)   // tracer.Cell{Row: r2, Col: c2}

HEAP (min-heap; Push/Pop animate the sift automatically)
  func NewHeap(name string) *Heap — Push(v int); Pop() int; Len() int; Empty() bool

TRIE
  func NewTrie(name string) *Trie — Insert(word string); Search(word string) bool

RECURSION (one line at the top of any recursive function — call stack animates)
  defer tracer.Enter("funcName", map[string]any{"arg": value})()

COMMON MISTAKES — DO NOT MAKE THESE:
- arr.Get(i).(int)          WRONG: Get returns int, not interface{} — no type assertion
- &tracer.NewArray(...)     WRONG: constructors already return pointers
- twoSum(&arr, ...)         WRONG when arr is already *tracer.Array — pass arr directly
- values other than int in structures — the SDK is int-only; adapt or leave untraced
`;

function buildPrompt(code: string): string {
  return `You convert a user's raw Go solution into a traced, runnable visualization program.

TRACER SDK (the ONLY tracing API available):
${TRACER_API_GO}

RULES:
1. Preserve the user's algorithm EXACTLY — same logic, same complexity, same variable names where possible. Only swap data-structure operations for tracer equivalents.
2. Output ONE complete runnable file: package main + all imports + func main().
3. If the user pasted only a solution function (no main), synthesize main() with a small,
   illustrative sample input (5-8 elements) that exercises the algorithm, call the function,
   and print the result with fmt.
4. Trace the PRIMARY data structures of the algorithm. Recursion gets tracer.Enter.
5. Only use the standard library plus "dsaviz/tracer". No other imports.
6. If the code is not Go or is not an algorithm, still return valid JSON with your best attempt.
7. "concept" = short human label like "linked list reversal", "BFS on graph", "0/1 knapsack".
8. "plugin" = which renderer fits the primary structure:
   sequence (arrays/strings/stacks/queues/deques), node-link (linked lists/trees/graphs/tries),
   table (DP tables/grids), heap (heaps/priority queues).

USER CODE:
\`\`\`go
${code}
\`\`\``;
}

export type AutotraceOutcome =
  | { ok: true; result: AutotraceResult }
  | { ok: false; error: "not_configured" | "upstream_error" | "quota_exceeded" | "bad_response" };

export async function autotrace(code: string, config: Config): Promise<AutotraceOutcome> {
  return callGemini(buildPrompt(code), config);
}

/** Second round: give the model its own broken output + compiler errors to fix. */
export async function autotraceRepair(
  originalCode: string,
  brokenCode: string,
  compilerErrors: string,
  config: Config,
): Promise<AutotraceOutcome> {
  const prompt = `Your previous rewrite of a Go solution FAILED TO COMPILE. Fix it.

TRACER SDK (the ONLY tracing API available):
${TRACER_API_GO}

ORIGINAL USER CODE:
\`\`\`go
${originalCode}
\`\`\`

YOUR PREVIOUS (BROKEN) OUTPUT:
\`\`\`go
${brokenCode}
\`\`\`

COMPILER ERRORS:
${compilerErrors}

Return the corrected, complete, compiling program in the same JSON shape as before.`;
  return callGemini(prompt, config);
}

async function callGemini(prompt: string, config: Config): Promise<AutotraceOutcome> {
  if (!config.GEMINI_API_KEY) return { ok: false, error: "not_configured" };

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        // Header (not query param) keeps the key out of URLs and access logs.
        "x-goog-api-key": config.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              concept: { type: "string" },
              plugin: { type: "string", enum: [...PLUGINS] },
              code: { type: "string" },
            },
            required: ["concept", "plugin", "code"],
          },
        },
      }),
    });
  } catch {
    return { ok: false, error: "upstream_error" }; // network/timeout — details stay server-side
  }

  if (response.status === 429) return { ok: false, error: "quota_exceeded" };
  if (!response.ok) return { ok: false, error: "upstream_error" };

  try {
    const envelope = GeminiEnvelope.parse(await response.json());
    const parsed: unknown = JSON.parse(envelope.candidates[0]!.content.parts[0]!.text);
    const result = ResultSchema.parse(parsed);
    return { ok: true, result };
  } catch {
    return { ok: false, error: "bad_response" };
  }
}
