// Command rewrite auto-instruments raw Go source with dsaviz tracer calls.
//
// It parses the file, finds int-slice variables declared with a literal or make()
// (e.g. `nums := []int{...}`), and — if the variable is only used in supported ways —
// rewrites its uses:
//
//	nums := []int{5, 2}          ->  nums := tracer.NewArray("nums", []int{5, 2})
//	nums[i]                      ->  nums.Get(i)
//	nums[i] = v                  ->  nums.Set(i, v)
//	nums[i], nums[j] = nums[j], nums[i]  ->  nums.Swap(i, j)
//	nums[i] += v / nums[i]++     ->  nums.Set(i, nums.Get(i) + ...)
//	len(nums)                    ->  nums.Len()
//
// Variables used in UNSUPPORTED ways (append, slicing, range, taken address, passed
// to a function, reassigned or aliased) are conservatively skipped — their code is
// left byte-for-byte alone, so the program still compiles and runs untraced.
//
// Usage: rewrite <file.go>   — prints the rewritten source to stdout.
// Exit codes: 0 ok (even if nothing was rewritten), 21 parse error.
package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: rewrite <file.go>")
		os.Exit(2)
	}
	src, err := os.ReadFile(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, "rewrite:", err)
		os.Exit(2)
	}

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "main.go", src, parser.ParseComments)
	if err != nil {
		fmt.Fprintln(os.Stderr, "rewrite: parse error:", err)
		os.Exit(21)
	}

	changed := false
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil {
			continue
		}
		cands := candidates(fn)
		if len(cands) == 0 {
			continue
		}
		rw := &rewriter{cands: cands}
		rw.block(fn.Body)
		if rw.changed {
			changed = true
		}
	}
	if changed {
		addTracerImport(file)
	}
	if err := printer.Fprint(os.Stdout, fset, file); err != nil {
		fmt.Fprintln(os.Stderr, "rewrite: print error:", err)
		os.Exit(2)
	}
}

// ---------------------------------------------------------------------------
// Candidate discovery: int-slice vars declared in this function that are used
// only in ways we can rewrite.
// ---------------------------------------------------------------------------

// isIntSliceLit reports whether e is `[]int{...}` or `make([]int, ...)`.
func isIntSliceExpr(e ast.Expr) bool {
	switch v := e.(type) {
	case *ast.CompositeLit:
		return isIntSliceType(v.Type)
	case *ast.CallExpr:
		if fun, ok := v.Fun.(*ast.Ident); ok && fun.Name == "make" && len(v.Args) >= 1 {
			return isIntSliceType(v.Args[0])
		}
	}
	return false
}

func isIntSliceType(t ast.Expr) bool {
	at, ok := t.(*ast.ArrayType)
	if !ok || at.Len != nil {
		return false
	}
	id, ok := at.Elt.(*ast.Ident)
	return ok && id.Name == "int"
}

// candidates returns the set of variable names eligible for tracing in fn.
func candidates(fn *ast.FuncDecl) map[string]bool {
	declared := map[string]bool{}
	ast.Inspect(fn.Body, func(n ast.Node) bool {
		as, ok := n.(*ast.AssignStmt)
		if !ok || as.Tok != token.DEFINE || len(as.Lhs) != 1 || len(as.Rhs) != 1 {
			return true
		}
		id, ok := as.Lhs[0].(*ast.Ident)
		if !ok || id.Name == "_" {
			return true
		}
		if isIntSliceExpr(as.Rhs[0]) {
			declared[id.Name] = true
		}
		return true
	})
	if len(declared) == 0 {
		return nil
	}

	// Disqualify any candidate used in a way we can't rewrite.
	disq := func(name string) { delete(declared, name) }
	ast.Inspect(fn.Body, func(n ast.Node) bool {
		switch v := n.(type) {
		case *ast.CallExpr:
			// Any call taking the bare slice disqualifies it — except len(x).
			isLen := false
			if fun, ok := v.Fun.(*ast.Ident); ok && fun.Name == "len" {
				isLen = true
			}
			for _, arg := range v.Args {
				if id, ok := arg.(*ast.Ident); ok && declared[id.Name] && !isLen {
					disq(id.Name)
				}
			}
		case *ast.SliceExpr:
			if id, ok := v.X.(*ast.Ident); ok && declared[id.Name] {
				disq(id.Name)
			}
		case *ast.RangeStmt:
			if id, ok := v.X.(*ast.Ident); ok && declared[id.Name] {
				disq(id.Name)
			}
		case *ast.UnaryExpr:
			if v.Op == token.AND {
				if id, ok := v.X.(*ast.Ident); ok && declared[id.Name] {
					disq(id.Name)
				}
			}
		case *ast.AssignStmt:
			for i, lhs := range v.Lhs {
				// Rebinding the whole variable (x = ...) — but allow its own declaration.
				if id, ok := lhs.(*ast.Ident); ok && declared[id.Name] && v.Tok != token.DEFINE {
					disq(id.Name)
				}
				_ = i
			}
			// Aliasing: y := x (bare candidate on the RHS of any assignment).
			for _, rhs := range v.Rhs {
				if id, ok := rhs.(*ast.Ident); ok && declared[id.Name] {
					disq(id.Name)
				}
			}
		}
		return true
	})
	return declared
}

// ---------------------------------------------------------------------------
// Rewriting
// ---------------------------------------------------------------------------

type rewriter struct {
	cands   map[string]bool
	changed bool
}

func (r *rewriter) isCandIndex(e ast.Expr) (name string, index ast.Expr, ok bool) {
	ie, isIdx := e.(*ast.IndexExpr)
	if !isIdx {
		return "", nil, false
	}
	id, isID := ie.X.(*ast.Ident)
	if !isID || !r.cands[id.Name] {
		return "", nil, false
	}
	return id.Name, ie.Index, true
}

func call(recv, method string, args ...ast.Expr) *ast.CallExpr {
	return &ast.CallExpr{
		Fun:  &ast.SelectorExpr{X: ast.NewIdent(recv), Sel: ast.NewIdent(method)},
		Args: args,
	}
}

// expr rewrites reads inside an expression tree, returning the replacement.
func (r *rewriter) expr(e ast.Expr) ast.Expr {
	switch v := e.(type) {
	case *ast.IndexExpr:
		if name, idx, ok := r.isCandIndex(v); ok {
			r.changed = true
			return call(name, "Get", r.expr(idx))
		}
		v.X = r.expr(v.X)
		v.Index = r.expr(v.Index)
	case *ast.CallExpr:
		// len(x) -> x.Len()
		if fun, ok := v.Fun.(*ast.Ident); ok && fun.Name == "len" && len(v.Args) == 1 {
			if id, ok := v.Args[0].(*ast.Ident); ok && r.cands[id.Name] {
				r.changed = true
				return call(id.Name, "Len")
			}
		}
		v.Fun = r.expr(v.Fun)
		for i := range v.Args {
			v.Args[i] = r.expr(v.Args[i])
		}
	case *ast.BinaryExpr:
		v.X = r.expr(v.X)
		v.Y = r.expr(v.Y)
	case *ast.ParenExpr:
		v.X = r.expr(v.X)
	case *ast.UnaryExpr:
		v.X = r.expr(v.X)
	case *ast.CompositeLit:
		for i := range v.Elts {
			v.Elts[i] = r.expr(v.Elts[i])
		}
	case *ast.KeyValueExpr:
		v.Value = r.expr(v.Value)
	}
	return e
}

// compoundOp maps += etc. to their binary operator.
var compoundOp = map[token.Token]token.Token{
	token.ADD_ASSIGN: token.ADD, token.SUB_ASSIGN: token.SUB,
	token.MUL_ASSIGN: token.MUL, token.QUO_ASSIGN: token.QUO,
	token.REM_ASSIGN: token.REM,
}

// stmt rewrites a single statement, returning its replacement.
func (r *rewriter) stmt(s ast.Stmt) ast.Stmt {
	switch v := s.(type) {
	case *ast.AssignStmt:
		// Declaration of a candidate: x := []int{...} / make([]int, n)
		if v.Tok == token.DEFINE && len(v.Lhs) == 1 && len(v.Rhs) == 1 {
			if id, ok := v.Lhs[0].(*ast.Ident); ok && r.cands[id.Name] && isIntSliceExpr(v.Rhs[0]) {
				r.changed = true
				v.Rhs[0] = &ast.CallExpr{
					Fun: &ast.SelectorExpr{X: ast.NewIdent("tracer"), Sel: ast.NewIdent("NewArray")},
					Args: []ast.Expr{
						&ast.BasicLit{Kind: token.STRING, Value: fmt.Sprintf("%q", id.Name)},
						r.expr(v.Rhs[0]),
					},
				}
				return v
			}
		}
		// Swap: x[i], x[j] = x[j], x[i]
		if v.Tok == token.ASSIGN && len(v.Lhs) == 2 && len(v.Rhs) == 2 {
			ln1, li1, ok1 := r.isCandIndex(v.Lhs[0])
			ln2, li2, ok2 := r.isCandIndex(v.Lhs[1])
			rn1, ri1, ok3 := r.isCandIndex(v.Rhs[0])
			rn2, ri2, ok4 := r.isCandIndex(v.Rhs[1])
			if ok1 && ok2 && ok3 && ok4 && ln1 == ln2 && ln1 == rn1 && ln1 == rn2 &&
				sameExpr(li1, ri2) && sameExpr(li2, ri1) {
				r.changed = true
				return &ast.ExprStmt{X: call(ln1, "Swap", r.expr(li1), r.expr(li2))}
			}
		}
		// Write: x[i] = v  |  x[i] += v ...
		if len(v.Lhs) == 1 && len(v.Rhs) == 1 {
			if name, idx, ok := r.isCandIndex(v.Lhs[0]); ok {
				r.changed = true
				rhs := r.expr(v.Rhs[0])
				if op, isCompound := compoundOp[v.Tok]; isCompound {
					rhs = &ast.BinaryExpr{X: call(name, "Get", r.expr(idx)), Op: op, Y: rhs}
				}
				return &ast.ExprStmt{X: call(name, "Set", r.expr(idx), rhs)}
			}
		}
		for i := range v.Rhs {
			v.Rhs[i] = r.expr(v.Rhs[i])
		}
		for i := range v.Lhs {
			v.Lhs[i] = r.expr(v.Lhs[i])
		}
		return v

	case *ast.IncDecStmt:
		// x[i]++ / x[i]--
		if name, idx, ok := r.isCandIndex(v.X); ok {
			r.changed = true
			op := token.ADD
			if v.Tok == token.DEC {
				op = token.SUB
			}
			one := &ast.BasicLit{Kind: token.INT, Value: "1"}
			return &ast.ExprStmt{X: call(name, "Set", r.expr(idx),
				&ast.BinaryExpr{X: call(name, "Get", r.expr(idx)), Op: op, Y: one})}
		}
		return v

	case *ast.ExprStmt:
		v.X = r.expr(v.X)
	case *ast.IfStmt:
		if v.Init != nil {
			v.Init = r.stmt(v.Init)
		}
		v.Cond = r.expr(v.Cond)
		r.block(v.Body)
		if v.Else != nil {
			v.Else = r.stmt(v.Else)
		}
	case *ast.ForStmt:
		if v.Init != nil {
			v.Init = r.stmt(v.Init)
		}
		if v.Cond != nil {
			v.Cond = r.expr(v.Cond)
		}
		if v.Post != nil {
			v.Post = r.stmt(v.Post)
		}
		r.block(v.Body)
	case *ast.RangeStmt:
		r.block(v.Body) // range over a candidate was already disqualified
	case *ast.BlockStmt:
		r.block(v)
	case *ast.SwitchStmt:
		if v.Tag != nil {
			v.Tag = r.expr(v.Tag)
		}
		r.block(v.Body)
	case *ast.CaseClause:
		for i := range v.List {
			v.List[i] = r.expr(v.List[i])
		}
		for i := range v.Body {
			v.Body[i] = r.stmt(v.Body[i])
		}
	case *ast.ReturnStmt:
		for i := range v.Results {
			v.Results[i] = r.expr(v.Results[i])
		}
	case *ast.DeclStmt:
		// var blocks unsupported for candidates (only := declares them); leave as-is.
	}
	return s
}

func (r *rewriter) block(b *ast.BlockStmt) {
	for i := range b.List {
		b.List[i] = r.stmt(b.List[i])
	}
}

// sameExpr: conservative structural equality for swap detection (idents, ints,
// simple binary combos like j+1).
func sameExpr(a, b ast.Expr) bool {
	switch av := a.(type) {
	case *ast.Ident:
		bv, ok := b.(*ast.Ident)
		return ok && av.Name == bv.Name
	case *ast.BasicLit:
		bv, ok := b.(*ast.BasicLit)
		return ok && av.Kind == bv.Kind && av.Value == bv.Value
	case *ast.BinaryExpr:
		bv, ok := b.(*ast.BinaryExpr)
		return ok && av.Op == bv.Op && sameExpr(av.X, bv.X) && sameExpr(av.Y, bv.Y)
	case *ast.ParenExpr:
		return sameExpr(av.X, b)
	}
	return false
}

// addTracerImport inserts `import "dsaviz/tracer"` if missing.
func addTracerImport(f *ast.File) {
	for _, imp := range f.Imports {
		if imp.Path.Value == `"dsaviz/tracer"` {
			return
		}
	}
	spec := &ast.ImportSpec{Path: &ast.BasicLit{Kind: token.STRING, Value: `"dsaviz/tracer"`}}
	// Reuse the first existing import block if there is one.
	for _, d := range f.Decls {
		if gd, ok := d.(*ast.GenDecl); ok && gd.Tok == token.IMPORT {
			gd.Specs = append(gd.Specs, spec)
			if len(gd.Specs) > 1 {
				gd.Lparen = 1 // force parenthesized form
			}
			f.Imports = append(f.Imports, spec)
			return
		}
	}
	gd := &ast.GenDecl{Tok: token.IMPORT, Specs: []ast.Spec{spec}}
	f.Decls = append([]ast.Decl{gd}, f.Decls...)
	f.Imports = append(f.Imports, spec)
}
