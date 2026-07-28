# Images and diagrams

The client mark below is a project-local SVG and should remain vector in the
combined document.

![Northstar Systems compass mark and wordmark](../assets/northstar-logo.svg)

The flow proceeds from Markdown through validation and rendering to a reviewed
PDF artifact.

<!-- diagram-alt: Markdown passes through validation and rendering before the PDF is visually reviewed. -->
```mermaid
flowchart LR
    MD[Markdown] --> Validate[Validate]
    Validate --> Render[Render]
    Render --> PDF[PDF]
    PDF --> Review[Visual review]
```

## Additional relationships

The second diagram verifies branching, labeled edges, and rounded nodes.

<!-- diagram-alt: A theme preset supplies typography and colors to both page chrome and semantic content. -->
```mermaid
flowchart TD
    Theme([Theme preset]) -->|tokens| Chrome[Header and footer]
    Theme -->|tokens| Content[Semantic content]
    Content --> Callouts[Callouts]
    Content --> Tables[Tables]
```
