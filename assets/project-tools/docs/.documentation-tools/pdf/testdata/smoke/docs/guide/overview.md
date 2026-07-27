# Renderer smoke test

This page verifies ordinary Markdown and a footnote.[^footnote]

> [!WARNING]
> This warning is rendered as a styled, page-breakable box.

<!-- markdownlint-disable-next-line MD028 -->
> **Planned**
>
> This planned capability uses its own visual treatment.

The inline expression $x \le y$ is passed through Pandoc's math representation.

The [external maintenance notes](external.md) remain useful in Markdown but are
not part of this rendered guide.

The [missing release notes](../missing.md#draft) demonstrate an invalid local
link rendered as a notice annotation.

<!-- diagram-alt: A request flows through the Go renderer and Pandoc to a PDF. -->

```mermaid
flowchart LR
    Markdown --> Go
    Go --> Pandoc
    Pandoc --> PDF
```

[^footnote]: Footnotes are handled by Pandoc and remain available to Lua filters.
