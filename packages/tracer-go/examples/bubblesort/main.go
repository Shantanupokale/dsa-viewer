// Example Phase-0 solution: bubble sort written against the tracer SDK.
//
// Run standalone:  go run ./examples/bubblesort   (reads ints from stdin, or uses a demo)
// This is also the fixture the server smoke test submits to /api/run.
package main

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
		nums = []int{5, 2, 9, 1, 5, 6} // demo input when stdin is empty
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

	// Ordinary output: passes through stdout untouched, is NOT a trace line.
	fmt.Println("done")
}

// readInts reads all whitespace-separated integers from r. Non-integer tokens are
// skipped, so an optional leading count is harmless.
func readInts(r *os.File) []int {
	scanner := bufio.NewScanner(r)
	scanner.Split(bufio.ScanWords)
	var out []int
	for scanner.Scan() {
		if v, err := strconv.Atoi(scanner.Text()); err == nil {
			out = append(out, v)
		}
	}
	return out
}
