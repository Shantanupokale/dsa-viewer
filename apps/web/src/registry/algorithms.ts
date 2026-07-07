/**
 * Algorithm Registry (PRD §10.1) — DATA, not code. Adding an algorithm that reuses an
 * existing plugin is a single entry here, zero renderer changes. Phase 0 ships two Go
 * examples, both on the `sequence` plugin, to prove that reuse.
 */
export type Language = "go" | "java" | "cpp";

export interface AlgorithmDescriptor {
  id: string;
  displayName: string;
  language: Language;
  primaryPlugin: string;
  secondaryPanels: string[];
  defaultCode: string;
  /** run with auto-instrumentation on by default (raw code, no tracer calls) */
  instrument?: boolean;
}

const BUBBLE_SORT_GO = `package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"

	"dsaviz/tracer"
)

func main() {
	nums := readInts(os.Stdin)
	if len(nums) == 0 {
		nums = []int{5, 2, 9, 1, 5, 6}
	}

	arr := tracer.NewArray("nums", nums)
	n := arr.Len()
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-1-i; j++ {
			if arr.Get(j) > arr.Get(j+1) {
				arr.Swap(j, j+1)
			}
		}
	}
	fmt.Println("done")
}

func readInts(r *os.File) []int {
	s := bufio.NewScanner(r)
	s.Split(bufio.ScanWords)
	var out []int
	for s.Scan() {
		if v, err := strconv.Atoi(s.Text()); err == nil {
			out = append(out, v)
		}
	}
	return out
}
`;

const REVERSE_ARRAY_GO = `package main

import (
	"fmt"

	"dsaviz/tracer"
)

func main() {
	arr := tracer.NewArray("nums", []int{1, 2, 3, 4, 5, 6})
	i, j := 0, arr.Len()-1
	for i < j {
		arr.Swap(i, j)
		i++
		j--
	}
	fmt.Println("reversed")
}
`;

const NEXT_GREATER_GO = `package main

import (
	"fmt"

	"dsaviz/tracer"
)

// Next greater element — monotonic stack of values.
func main() {
	arr := tracer.NewArray("nums", []int{2, 1, 5, 3, 6, 4})
	stack := tracer.NewStack("stack")
	for i := 0; i < arr.Len(); i++ {
		x := arr.Get(i)
		for !stack.Empty() && stack.Peek() < x {
			stack.Pop()
		}
		stack.Push(x)
	}
	fmt.Println("done")
}
`;

const VALID_PARENS_GO = `package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"dsaviz/tracer"
)

// Valid parentheses. Note: the stack shows ASCII codes of the bracket chars.
func main() {
	s := readLine(os.Stdin)
	if s == "" {
		s = "([]{})"
	}
	stack := tracer.NewStack("stack")
	ok := true
	match := map[byte]byte{')': '(', ']': '[', '}': '{'}
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '(', '[', '{':
			stack.Push(int(c))
		case ')', ']', '}':
			if stack.Empty() || stack.Pop() != int(match[c]) {
				ok = false
			}
		}
	}
	if !stack.Empty() {
		ok = false
	}
	fmt.Println("valid:", ok)
}

func readLine(f *os.File) string {
	sc := bufio.NewScanner(f)
	if sc.Scan() {
		return strings.TrimSpace(sc.Text())
	}
	return ""
}
`;

const SLIDING_WINDOW_GO = `package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"

	"dsaviz/tracer"
)

// Sliding window maximum — a deque of indices (front = current max) over an array.
func main() {
	nums := readInts(os.Stdin)
	if len(nums) == 0 {
		nums = []int{1, 3, -1, -3, 5, 3, 6, 7}
	}
	const k = 3

	arr := tracer.NewArray("nums", nums)
	window := tracer.NewDeque("window") // holds indices

	for i := 0; i < arr.Len(); i++ {
		for !window.Empty() && arr.Get(window.Back()) <= arr.Get(i) {
			window.PopBack()
		}
		window.PushBack(i)
		if window.Front() <= i-k {
			window.PopFront()
		}
	}
	fmt.Println("done")
}

func readInts(r *os.File) []int {
	s := bufio.NewScanner(r)
	s.Split(bufio.ScanWords)
	var out []int
	for s.Scan() {
		if v, err := strconv.Atoi(s.Text()); err == nil {
			out = append(out, v)
		}
	}
	return out
}
`;

const BUBBLE_SORT_JAVA = `import dsaviz.*;

// The class MUST be named Main.
public class Main {
    public static void main(String[] args) {
        int[] nums = {5, 2, 9, 1, 5, 6};
        Array arr = new Array("nums", nums);
        int n = arr.len();
        for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - 1 - i; j++) {
                if (arr.get(j) > arr.get(j + 1)) {
                    arr.swap(j, j + 1);
                }
            }
        }
        System.out.println("done");
    }
}
`;

const NEXT_GREATER_JAVA = `import dsaviz.*;

public class Main {
    public static void main(String[] args) {
        int[] nums = {2, 1, 5, 3, 6, 4};
        Array arr = new Array("nums", nums);
        Stack stack = new Stack("stack");
        for (int i = 0; i < arr.len(); i++) {
            int x = arr.get(i);
            while (!stack.empty() && stack.peek() < x) {
                stack.pop();
            }
            stack.push(x);
        }
        System.out.println("done");
    }
}
`;

const BUBBLE_SORT_CPP = `#include "tracer.hpp"

int main() {
    tracer::Array arr("nums", {5, 2, 9, 1, 5, 6});
    int n = arr.len();
    for (int i = 0; i < n - 1; i++)
        for (int j = 0; j < n - 1 - i; j++)
            if (arr.get(j) > arr.get(j + 1))
                arr.swap(j, j + 1);
    return 0;
}
`;

const NEXT_GREATER_CPP = `#include "tracer.hpp"

int main() {
    tracer::Array arr("nums", {2, 1, 5, 3, 6, 4});
    tracer::Stack stack("stack");
    for (int i = 0; i < arr.len(); i++) {
        int x = arr.get(i);
        while (!stack.empty() && stack.peek() < x) stack.pop();
        stack.push(x);
    }
    return 0;
}
`;

const REVERSE_LIST_GO = `package main

import "dsaviz/tracer"

func main() {
	ll := tracer.NewLinkedList("list")

	// Build 1 -> 2 -> 3 -> 4 -> 5
	var ids []string
	for _, v := range []int{1, 2, 3, 4, 5} {
		ids = append(ids, ll.NewNode(v))
	}
	for i := 0; i+1 < len(ids); i++ {
		ll.SetNext(ids[i], ids[i+1])
	}

	// Reverse the list in place, flipping each next pointer.
	prev := ""
	cur := ids[0]
	for cur != "" {
		ll.Visit(cur)
		next := ll.NextOf(cur)
		ll.SetNext(cur, prev)
		prev = cur
		cur = next
	}
}
`;

const FIB_MEMO_GO = `package main

import "dsaviz/tracer"

var memo *tracer.Array

// One line auto-instruments the call stack — no manual push/return.
func fib(n int) int {
	defer tracer.Enter("fib", map[string]any{"n": n})()
	if n < 2 {
		return n
	}
	if v := memo.Get(n); v != 0 {
		return v
	}
	r := fib(n-1) + fib(n-2)
	memo.Set(n, r)
	return r
}

func main() {
	memo = tracer.NewArray("memo", make([]int, 11))
	fib(10)
}
`;

const BST_INORDER_GO = `package main

import "dsaviz/tracer"

func main() {
	t := tracer.NewTree("bst")

	//         4
	//       /   \\
	//      2     6
	//     / \\   / \\
	//    1  3  5  7
	vals := map[string]int{"4": 4, "2": 2, "6": 6, "1": 1, "3": 3, "5": 5, "7": 7}
	for _, id := range []string{"4", "2", "6", "1", "3", "5", "7"} {
		t.AddNode(id, vals[id])
	}
	for _, e := range [][2]string{{"4", "2"}, {"4", "6"}, {"2", "1"}, {"2", "3"}, {"6", "5"}, {"6", "7"}} {
		t.AddEdge(e[0], e[1])
	}

	children := map[string][2]string{"4": {"2", "6"}, "2": {"1", "3"}, "6": {"5", "7"}}
	var inorder func(id string)
	inorder = func(id string) {
		defer tracer.Enter("inorder", map[string]any{"node": id})()
		if kids, ok := children[id]; ok {
			inorder(kids[0])
			t.Visit(id)
			inorder(kids[1])
		} else {
			t.Visit(id)
		}
	}
	inorder("4")
}
`;

const BFS_GO = `package main

import "dsaviz/tracer"

func main() {
	g := tracer.NewGraph("graph")
	for _, id := range []string{"A", "B", "C", "D", "E", "F"} {
		g.AddVertex(id)
	}
	adj := map[string][]string{}
	for _, e := range [][2]string{{"A", "B"}, {"A", "C"}, {"B", "D"}, {"C", "D"}, {"C", "E"}, {"D", "F"}, {"E", "F"}} {
		g.AddEdge(e[0], e[1])
		adj[e[0]] = append(adj[e[0]], e[1])
		adj[e[1]] = append(adj[e[1]], e[0])
	}

	// Breadth-first search from A.
	visited := map[string]bool{"A": true}
	queue := []string{"A"}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		g.Visit(cur)
		for _, nb := range adj[cur] {
			if !visited[nb] {
				visited[nb] = true
				g.TraverseEdge(cur, nb)
				queue = append(queue, nb)
			}
		}
	}
}
`;

const KNAPSACK_GO = `package main

import "dsaviz/tracer"

// 0/1 knapsack. dp[i][w] = best value using the first i items at capacity w.
// SetWithDeps records which cells each value came from — rendered as arrows.
func main() {
	weights := []int{2, 3, 4, 5}
	values := []int{3, 4, 5, 6}
	const W = 8

	dp := tracer.NewDPTable("dp", len(weights)+1, W+1)
	for i := 1; i <= len(weights); i++ {
		for w := 0; w <= W; w++ {
			skip := dp.Get(i-1, w)
			if weights[i-1] > w {
				dp.SetWithDeps(i, w, skip, []tracer.Cell{{Row: i - 1, Col: w}})
				continue
			}
			take := dp.Get(i-1, w-weights[i-1]) + values[i-1]
			if take > skip {
				dp.SetWithDeps(i, w, take, []tracer.Cell{{Row: i - 1, Col: w - weights[i-1]}})
			} else {
				dp.SetWithDeps(i, w, skip, []tracer.Cell{{Row: i - 1, Col: w}})
			}
		}
	}
}
`;

const HEAP_SORT_GO = `package main

import (
	"fmt"

	"dsaviz/tracer"
)

// Heap sort via a traced min-heap: push everything, pop in sorted order.
// Every sift-up/sift-down swap animates in the tree.
func main() {
	h := tracer.NewHeap("heap")
	for _, v := range []int{7, 3, 9, 1, 5, 8, 2} {
		h.Push(v)
	}
	for !h.Empty() {
		fmt.Println(h.Pop())
	}
}
`;

const TRIE_GO = `package main

import (
	"fmt"

	"dsaviz/tracer"
)

// Build a trie from words sharing prefixes, then search it.
func main() {
	tr := tracer.NewTrie("trie")
	for _, w := range []string{"cat", "car", "card", "dog", "do"} {
		tr.Insert(w)
	}
	fmt.Println("card:", tr.Search("card"))
	fmt.Println("cab:", tr.Search("cab"))
}
`;

const RAW_BUBBLE_GO = `package main

import "fmt"

// RAW Go — no tracer calls. Auto-instrumentation rewrites the []int usage
// into traced operations before compiling. Write it like a normal solution.
func main() {
	nums := []int{5, 2, 9, 1, 5, 6}
	n := len(nums)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-1-i; j++ {
			if nums[j] > nums[j+1] {
				nums[j], nums[j+1] = nums[j+1], nums[j]
			}
		}
	}
	fmt.Println("sorted:", nums[0])
}
`;

export const algorithms: AlgorithmDescriptor[] = [
  {
    id: "raw-bubble-sort",
    displayName: "★ Raw Go — bubble sort (auto-instrumented)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: RAW_BUBBLE_GO,
    instrument: true,
  },
  {
    id: "reverse-linked-list",
    displayName: "Reverse linked list (Go)",
    language: "go",
    primaryPlugin: "node-link",
    secondaryPanels: ["variables"],
    defaultCode: REVERSE_LIST_GO,
  },
  {
    id: "fibonacci-memo",
    displayName: "Fibonacci — memoized + recursion (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables", "call-stack"],
    defaultCode: FIB_MEMO_GO,
  },
  {
    id: "bst-inorder",
    displayName: "Binary tree — inorder traversal (Go)",
    language: "go",
    primaryPlugin: "node-link",
    secondaryPanels: ["variables", "call-stack"],
    defaultCode: BST_INORDER_GO,
  },
  {
    id: "bfs",
    displayName: "Breadth-first search — graph (Go)",
    language: "go",
    primaryPlugin: "node-link",
    secondaryPanels: ["variables"],
    defaultCode: BFS_GO,
  },
  {
    id: "knapsack",
    displayName: "0/1 Knapsack — DP table (Go)",
    language: "go",
    primaryPlugin: "table",
    secondaryPanels: ["variables"],
    defaultCode: KNAPSACK_GO,
  },
  {
    id: "heap-sort",
    displayName: "Heap sort — min-heap (Go)",
    language: "go",
    primaryPlugin: "heap",
    secondaryPanels: ["variables"],
    defaultCode: HEAP_SORT_GO,
  },
  {
    id: "trie-words",
    displayName: "Trie — insert & search (Go)",
    language: "go",
    primaryPlugin: "node-link",
    secondaryPanels: ["variables"],
    defaultCode: TRIE_GO,
  },
  {
    id: "bubble-sort",
    displayName: "Bubble sort (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: BUBBLE_SORT_GO,
  },
  {
    id: "reverse-array",
    displayName: "Reverse array — two pointers (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: REVERSE_ARRAY_GO,
  },
  {
    id: "next-greater-element",
    displayName: "Next greater element — stack (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: NEXT_GREATER_GO,
  },
  {
    id: "valid-parentheses",
    displayName: "Valid parentheses — stack (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: VALID_PARENS_GO,
  },
  {
    id: "sliding-window-maximum",
    displayName: "Sliding window maximum — deque + array (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: SLIDING_WINDOW_GO,
  },
  {
    id: "bubble-sort-java",
    displayName: "Bubble sort (Java)",
    language: "java",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: BUBBLE_SORT_JAVA,
  },
  {
    id: "next-greater-element-java",
    displayName: "Next greater element — stack (Java)",
    language: "java",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: NEXT_GREATER_JAVA,
  },
  {
    id: "bubble-sort-cpp",
    displayName: "Bubble sort (C++)",
    language: "cpp",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: BUBBLE_SORT_CPP,
  },
  {
    id: "next-greater-element-cpp",
    displayName: "Next greater element — stack (C++)",
    language: "cpp",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: NEXT_GREATER_CPP,
  },
];

export function getAlgorithm(id: string): AlgorithmDescriptor | undefined {
  return algorithms.find((a) => a.id === id);
}
