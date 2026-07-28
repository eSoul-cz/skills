# Renderer smoke test

This page verifies ordinary Markdown, a shared footnote[^shared], and another
reference to that same note.[^shared] It also exercises a complex footnote.[^complex]

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

[^shared]: Repeated references remain attached to the same authored note.

[^complex]: A multiline footnote keeps *emphasis*, inline `code`, a
    [reference link](https://example.com), and Czech text: příliš žluťoučký kůň.

    A second paragraph verifies that longer notes retain their structure.
