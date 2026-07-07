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
package tracer (import "dsaviz/tracer") — every call below emits visualization events:

SEQUENCE
  arr := tracer.NewArray("name", []int{...}); arr.Get(i); arr.Set(i, v); arr.Swap(i, j); arr.Len()
  s := tracer.NewStack("name"); s.Push(v); s.Pop(); s.Peek(); s.Empty(); s.Len()
  q := tracer.NewQueue("name"); q.Enqueue(v); q.Dequeue(); q.Peek(); q.Empty(); q.Len()
  d := tracer.NewDeque("name"); d.PushFront(v); d.PushBack(v); d.PopFront(); d.PopBack(); d.Front(); d.Back(); d.Empty(); d.Len()
  str := tracer.NewString("name", "text"); str.At(i); str.Compare(i, j); str.Len()

LINKED LIST (node ids are strings returned by NewNode)
  ll := tracer.NewLinkedList("name"); id := ll.NewNode(value); ll.SetNext(id, otherId) // "" for nil
  ll.NextOf(id) // current next id, "" if none;  ll.Visit(id) // highlight traversal

TREE / GRAPH
  t := tracer.NewTree("name")  // hierarchical layout
  g := tracer.NewGraph("name") // force layout
  .AddNode(id, value) / .AddVertex(id) / .AddEdge(fromId, toId) / .Visit(id) / .TraverseEdge(fromId, toId)

DP TABLE
  dp := tracer.NewDPTable("name", rows, cols); dp.Get(r, c); dp.Set(r, c, v)
  dp.SetWithDeps(r, c, v, []tracer.Cell{{Row: r2, Col: c2}}) // draws dependency arrows

HEAP (min-heap; Push/Pop animate the sift automatically)
  h := tracer.NewHeap("name"); h.Push(v); h.Pop(); h.Len(); h.Empty()

TRIE
  tr := tracer.NewTrie("name"); tr.Insert("word"); tr.Search("word")

RECURSION (one line at the top of any recursive function — call stack animates)
  defer tracer.Enter("funcName", map[string]any{"arg": value})()
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
        contents: [{ parts: [{ text: buildPrompt(code) }] }],
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
