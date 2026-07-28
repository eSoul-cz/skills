# Typography and readable structure

This page demonstrates body copy with **strong emphasis**, *ordinary emphasis*,
`inline code`, a [descriptive external link](https://example.com), and Czech
characters: příliš žluťoučký kůň.

## Headings and lists

The hierarchy should remain easy to scan without relying only on size or color.

- A concise unordered-list item
- A second item with **emphasized context**
- A final item containing `documentation-renderer`

1. Validate the authored Markdown.
2. Render diagrams and semantic elements.
3. Produce and inspect the final PDF.

### Quotation

> Good documentation makes the next safe action obvious.

The inline expression $x \leq y$ and the display expression below exercise
Pandoc's math representation:

$$
x^2 + y^2 = z^2
$$

This sentence references a compact note.[^compact] The same page also contains
a multiline note with formatting and Unicode text.[^detailed]

[^compact]: Footnotes remain attached to their authored references.

[^detailed]: A longer footnote preserves *emphasis*, `inline code`, and Czech
    text: příliš žluťoučký kůň.

    Its second paragraph verifies spacing and indentation.

## Code

```go
func render(source string) (string, error) {
	if source == "" {
		return "", errors.New("source is required")
	}
	return "documentation.pdf", nil
}
```
