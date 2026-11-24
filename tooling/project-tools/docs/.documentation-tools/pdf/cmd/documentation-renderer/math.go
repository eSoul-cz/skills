package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

// allowedMathCommands mirrors `allowed_math_commands` in filters/render.lua, the filter that fails the
// build on any other command. TestMathAllowListMatchesRenderFilter keeps both lists identical.
var allowedMathCommands = map[string]bool{
	"alpha": true, "approx": true, "bar": true, "beta": true, "cdot": true,
	"cos": true, "delta": true, "div": true, "epsilon": true, "exp": true,
	"frac": true, "gamma": true, "ge": true, "geq": true, "hat": true,
	"infty": true, "lambda": true, "langle": true, "le": true, "left": true,
	"leftarrow": true, "leq": true, "ln": true, "log": true, "mathbf": true,
	"mathit": true, "mathrm": true, "max": true, "min": true, "mp": true,
	"mu": true, "ne": true, "neq": true, "omega": true, "operatorname": true,
	"overline": true, "phi": true, "pi": true, "pm": true, "prod": true,
	"rangle": true, "right": true, "rightarrow": true, "sigma": true,
	"sin": true, "sqrt": true, "sum": true, "tan": true, "text": true,
	"theta": true, "times": true, "to": true, "underline": true, "vec": true,
}

var mathCommandPattern = regexp.MustCompile(`\\([A-Za-z@]+)`)

const mathFormulaPreviewLimit = 60

// checkMathFormula applies the rules of the render filter to one formula: no `^^` escapes, only allowed
// commands, and no control sequence other than a command.
func checkMathFormula(formula string) error {
	if strings.Contains(formula, "^^") {
		return errors.New("unsafe TeX math control sequence ^^")
	}
	for _, match := range mathCommandPattern.FindAllStringSubmatch(formula, -1) {
		if !allowedMathCommands[match[1]] {
			return fmt.Errorf("unsafe TeX math command \\%s", match[1])
		}
	}
	if strings.Contains(mathCommandPattern.ReplaceAllString(formula, ""), `\`) {
		return errors.New("unsafe TeX math control sequence")
	}
	return nil
}

// validateMath reports every formula of one source file that the PDF build would reject, so the failure
// shows up in `validate` with the file name instead of late in `build`.
func validateMath(relative string, document pandocDocument, result *validationResult) {
	reported := map[string]bool{}
	for _, formula := range pandocMath(document) {
		err := checkMathFormula(formula)
		if err == nil {
			continue
		}
		preview := []rune(strings.Join(strings.Fields(formula), " "))
		if len(preview) > mathFormulaPreviewLimit {
			preview = append(preview[:mathFormulaPreviewLimit], '…')
		}
		message := fmt.Sprintf(
			"%s: %s in formula `%s`; use basic commands (fractions, roots, sums, Greek letters, \\text, \\mathrm, \\operatorname) or a fenced code block.",
			relative, err, string(preview),
		)
		if !reported[message] {
			reported[message] = true
			result.error(message)
		}
	}
}

func pandocMath(document pandocDocument) []string {
	var formulas []string
	var visit func(any)
	visit = func(value any) {
		switch node := value.(type) {
		case map[string]any:
			if nodeType, _ := node["t"].(string); nodeType == "Math" {
				if content, ok := node["c"].([]any); ok && len(content) == 2 {
					if formula, ok := content[1].(string); ok {
						formulas = append(formulas, formula)
					}
				}
			}
			for _, child := range node {
				visit(child)
			}
		case []any:
			for _, child := range node {
				visit(child)
			}
		}
	}
	raw, _ := json.Marshal(document.Blocks)
	var blocks any
	if json.Unmarshal(raw, &blocks) == nil {
		visit(blocks)
	}
	return formulas
}
