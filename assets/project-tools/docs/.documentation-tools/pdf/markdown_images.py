from __future__ import annotations

import html
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class MarkdownImageReference:
    alt: str
    target: str
    offset: int
    end: int
    source_attribute: str = "src"


@dataclass(frozen=True)
class MarkdownLinkReference:
    label: str
    target: str
    offset: int
    end: int


def _mask_range(characters: list[str], start: int, end: int) -> None:
    for index in range(start, end):
        if characters[index] != "\n":
            characters[index] = " "


def _is_escaped(text: str, position: int) -> bool:
    backslashes = 0
    position -= 1
    while position >= 0 and text[position] == "\\":
        backslashes += 1
        position -= 1
    return backslashes % 2 == 1


def _newline_end(text: str, position: int) -> int | None:
    if position >= len(text) or text[position] not in "\r\n":
        return None
    if text[position : position + 2] == "\r\n":
        return position + 2
    return position + 1


def _container_content_start(line: str) -> int:
    position = 0
    while position < len(line):
        initial = position
        spaces = 0
        while position < len(line) and line[position] == " " and spaces < 3:
            position += 1
            spaces += 1
        if position < len(line) and line[position] == ">":
            position += 1
            if position < len(line) and line[position] == " ":
                position += 1
            continue
        list_marker = re.match(r"(?:[-+*]|\d{1,9}[.)])[ \t]+", line[position:])
        if list_marker is not None:
            position += len(list_marker.group(0))
            continue
        return initial
    return position


def _definition_mask(masked: str) -> str:
    characters = list(masked)
    offset = 0
    for line in masked.splitlines(keepends=True):
        content_start = _container_content_start(line)
        _mask_range(characters, offset, offset + content_start)
        offset += len(line)
    return "".join(characters)


def _block_quote_content_start(line: str) -> int:
    position = 0
    while position < len(line):
        initial = position
        spaces = 0
        while position < len(line) and line[position] == " " and spaces < 3:
            position += 1
            spaces += 1
        if position >= len(line) or line[position] != ">":
            return initial
        position += 1
        if position < len(line) and line[position] == " ":
            position += 1
    return position


def _masked_noncontent(text: str) -> str:
    characters = list(text)

    for comment in re.finditer(r"<!--.*?-->", text, re.DOTALL):
        _mask_range(characters, comment.start(), comment.end())

    masked = "".join(characters)
    offset = 0
    in_indented_code = False
    list_content_indent: int | None = None
    previous_was_blank = True
    for line in masked.splitlines(keepends=True):
        content = line.rstrip("\r\n")
        quote_content_start = _block_quote_content_start(content)
        container_content = content[quote_content_start:]
        if not container_content.strip():
            previous_was_blank = True
            offset += len(line)
            continue
        list_marker = re.match(
            r"^( *)(?:[-+*]|\d{1,9}[.)])([ \t]+)",
            container_content,
        )
        if list_marker is not None:
            list_content_indent = len(list_marker.group(1)) + len(
                list_marker.group(0)[len(list_marker.group(1)) :]
            )
            leading_indent = 0
        else:
            leading_match = re.match(r"^[ \t]*", container_content)
            leading_value = leading_match.group(0) if leading_match is not None else ""
            leading_indent = sum(4 if character == "\t" else 1 for character in leading_value)
            if list_content_indent is not None and leading_indent < list_content_indent:
                list_content_indent = None
        code_indent = (list_content_indent or 0) + 4
        indented = leading_indent >= code_indent
        if indented and (in_indented_code or previous_was_blank):
            _mask_range(characters, offset, offset + len(line))
            in_indented_code = True
        else:
            in_indented_code = False
        previous_was_blank = False
        offset += len(line)

    masked = "".join(characters)
    lines = masked.splitlines(keepends=True)
    offset = 0
    fence_character = ""
    fence_length = 0
    fence_start = 0
    for line in lines:
        if not fence_character:
            container_start = _container_content_start(line)
            opening = re.match(r"^ {0,3}(`{3,}|~{3,})", line[container_start:])
            if opening is not None:
                fence_character = opening.group(1)[0]
                fence_length = len(opening.group(1))
                fence_start = offset
        else:
            closing = re.match(
                rf"^[ \t]*(?:>[ \t]*)*{re.escape(fence_character)}"
                rf"{{{fence_length},}}[ \t]*(?:\r?\n|$)",
                line,
            )
            if closing is not None:
                _mask_range(characters, fence_start, offset + len(line))
                fence_character = ""
                fence_length = 0
        offset += len(line)
    if fence_character:
        _mask_range(characters, fence_start, len(text))

    masked = "".join(characters)
    position = 0
    while position < len(masked):
        if masked[position] != "`":
            position += 1
            continue
        run_end = position
        while run_end < len(masked) and masked[run_end] == "`":
            run_end += 1
        delimiter = masked[position:run_end]
        closing = masked.find(delimiter, run_end)
        if closing < 0:
            position = run_end
            continue
        _mask_range(characters, position, closing + len(delimiter))
        masked = "".join(characters)
        position = closing + len(delimiter)

    return "".join(characters)


def _parse_bracket(text: str, masked: str, opening: int) -> tuple[str, int] | None:
    if opening >= len(masked) or masked[opening] != "[":
        return None
    depth = 1
    position = opening + 1
    while position < len(masked):
        character = masked[position]
        if character == "\\" and position + 1 < len(masked):
            position += 2
            continue
        if character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
            if depth == 0:
                return text[opening + 1 : position], position
        position += 1
    return None


def _decode_destination(value: str) -> str:
    value = re.sub(r"\\([!-/:-@\[-`{-~])", r"\1", value)
    return html.unescape(value)


def _destination(
    text: str,
    masked: str,
    start: int,
    *,
    allow_leading_newline: bool,
) -> tuple[str, int] | None:
    position = start
    while position < len(masked) and masked[position] in " \t":
        position += 1
    newline_end = _newline_end(masked, position)
    if allow_leading_newline and newline_end is not None:
        position = newline_end
        while position < len(masked) and masked[position] in " \t":
            position += 1
    if position >= len(masked) or _newline_end(masked, position) is not None:
        return None

    if masked[position] == "<":
        target_start = position + 1
        position += 1
        while position < len(masked):
            if masked[position] == "\\" and position + 1 < len(masked):
                position += 2
                continue
            if masked[position] == ">":
                return _decode_destination(text[target_start:position]), position + 1
            if _newline_end(masked, position) is not None:
                return None
            position += 1
        return None

    target_start = position
    parenthesis_depth = 0
    while position < len(masked):
        character = masked[position]
        if character == "\\" and position + 1 < len(masked):
            position += 2
            continue
        if character in " \t\r\n":
            break
        if character == "(":
            parenthesis_depth += 1
        elif character == ")":
            if parenthesis_depth == 0:
                break
            parenthesis_depth -= 1
        position += 1
    if position == target_start or parenthesis_depth != 0:
        return None
    return _decode_destination(text[target_start:position]), position


def _inline_image_end(masked: str, position: int) -> int | None:
    while position < len(masked) and masked[position] in " \t\r\n":
        position += 1
    if position < len(masked) and masked[position] == ")":
        return position + 1
    if position >= len(masked) or masked[position] not in "\"'(":
        return None

    opening = masked[position]
    closing = ")" if opening == "(" else opening
    position += 1
    while position < len(masked):
        if masked[position] == "\\" and position + 1 < len(masked):
            position += 2
            continue
        if masked[position] == closing:
            position += 1
            break
        if masked[position] in "\r\n" and opening != "(":
            return None
        position += 1
    else:
        return None

    while position < len(masked) and masked[position] in " \t\r\n":
        position += 1
    return position + 1 if position < len(masked) and masked[position] == ")" else None


def _valid_reference_definition_remainder(masked: str, position: int) -> bool:
    while position < len(masked) and masked[position] in " \t":
        position += 1
    if position >= len(masked) or masked[position] in "\r\n":
        return True
    if masked[position] not in "\"'(":
        return False
    opening = masked[position]
    closing = ")" if opening == "(" else opening
    position += 1
    while position < len(masked):
        if masked[position] == "\\" and position + 1 < len(masked):
            position += 2
            continue
        if masked[position] == closing:
            position += 1
            break
        if masked[position] in "\r\n":
            return False
        position += 1
    else:
        return False
    while position < len(masked) and masked[position] in " \t":
        position += 1
    return position >= len(masked) or masked[position] in "\r\n"


def normalized_reference_label(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def markdown_destination(value: str) -> str:
    value = value.strip()
    if value.startswith("<"):
        closing = value.find(">", 1)
        if closing >= 0:
            return _decode_destination(value[1:closing])
    return _decode_destination(value.split(maxsplit=1)[0]) if value else ""


def _reference_definitions(text: str, masked: str) -> dict[str, str]:
    definitions: dict[str, str] = {}
    definition_mask = _definition_mask(masked)
    for line in re.finditer(r"(?m)^[ \t]*\[", definition_mask):
        opening = line.end() - 1
        label = _parse_bracket(text, definition_mask, opening)
        if label is None:
            continue
        label_text, closing = label
        position = closing + 1
        if position >= len(definition_mask) or definition_mask[position] != ":":
            continue
        destination = _destination(
            text,
            definition_mask,
            position + 1,
            allow_leading_newline=True,
        )
        if destination is not None and _valid_reference_definition_remainder(
            definition_mask,
            destination[1],
        ):
            definitions.setdefault(normalized_reference_label(label_text), destination[0])
    return definitions


def _raw_tags(masked: str) -> list[tuple[int, int]]:
    tags: list[tuple[int, int]] = []
    for opening in re.finditer(
        r"</?[A-Za-z][A-Za-z0-9:._-]*(?=[\s/>])",
        masked,
    ):
        position = opening.end()
        quote = ""
        while position < len(masked):
            character = masked[position]
            if quote:
                if character == quote:
                    quote = ""
            elif character in "\"'":
                quote = character
            elif character == ">":
                tags.append((opening.start(), position + 1))
                break
            position += 1
    return tags


def _raw_image_tags(masked: str) -> list[tuple[int, int]]:
    return [
        (start, end)
        for start, end in _raw_tags(masked)
        if re.match(r"<img(?=[\s/>])", masked[start:end], re.IGNORECASE)
    ]


def _raw_attributes(tag: str) -> dict[str, str]:
    attributes: dict[str, str] = {}
    position = 4
    while position < len(tag):
        while position < len(tag) and (tag[position].isspace() or tag[position] == "/"):
            position += 1
        name = re.match(r"[A-Za-z_:][A-Za-z0-9:._-]*", tag[position:])
        if name is None:
            position += 1
            continue
        attribute_name = name.group(0).casefold()
        position += len(name.group(0))
        while position < len(tag) and tag[position].isspace():
            position += 1
        value = ""
        if position < len(tag) and tag[position] == "=":
            position += 1
            while position < len(tag) and tag[position].isspace():
                position += 1
            if position < len(tag) and tag[position] in "\"'":
                quote = tag[position]
                position += 1
                start = position
                while position < len(tag) and tag[position] != quote:
                    position += 1
                value = tag[start:position]
                if position < len(tag):
                    position += 1
            else:
                start = position
                while position < len(tag) and not tag[position].isspace() and tag[position] != ">":
                    position += 1
                value = tag[start:position]
        attributes.setdefault(attribute_name, html.unescape(value))
    return attributes


def markdown_link_references(text: str) -> list[MarkdownLinkReference]:
    masked = _masked_noncontent(text)
    markdown_characters = list(masked)
    for start, end in _raw_tags(masked):
        _mask_range(markdown_characters, start, end)
    markdown_masked = "".join(markdown_characters)
    definitions = _reference_definitions(text, markdown_masked)
    references: list[MarkdownLinkReference] = []

    position = 0
    while position < len(markdown_masked):
        if markdown_masked[position] != "[" or _is_escaped(text, position):
            position += 1
            continue
        if (
            position > 0
            and markdown_masked[position - 1] == "!"
            and not _is_escaped(text, position - 1)
        ):
            position += 1
            continue
        label_result = _parse_bracket(text, markdown_masked, position)
        if label_result is None:
            position += 1
            continue
        label, label_closing = label_result
        following = label_closing + 1
        if following < len(markdown_masked) and markdown_masked[following] == "(":
            destination = _destination(
                text,
                markdown_masked,
                following + 1,
                allow_leading_newline=True,
            )
            if destination is not None:
                target, destination_end = destination
                link_end = _inline_image_end(markdown_masked, destination_end)
                if link_end is not None:
                    references.append(
                        MarkdownLinkReference(label, target, position, link_end)
                    )
                    position = link_end
                    continue
        elif following < len(markdown_masked) and markdown_masked[following] == "[":
            reference_result = _parse_bracket(text, markdown_masked, following)
            if reference_result is not None:
                reference_label, reference_closing = reference_result
                target = definitions.get(
                    normalized_reference_label(reference_label or label)
                )
                if target is not None:
                    references.append(
                        MarkdownLinkReference(
                            label,
                            target,
                            position,
                            reference_closing + 1,
                        )
                    )
                    position = reference_closing + 1
                    continue
        elif (
            following >= len(markdown_masked)
            or markdown_masked[following] != ":"
        ):
            target = definitions.get(normalized_reference_label(label))
            if target is not None:
                references.append(
                    MarkdownLinkReference(label, target, position, label_closing + 1)
                )
                position = label_closing + 1
                continue
        position = label_closing + 1

    return references


def markdown_image_references(text: str) -> list[MarkdownImageReference]:
    masked = _masked_noncontent(text)
    references: list[MarkdownImageReference] = []

    raw_tags = _raw_image_tags(masked)
    markdown_characters = list(masked)
    for start, end in raw_tags:
        _mask_range(markdown_characters, start, end)
    markdown_masked = "".join(markdown_characters)
    definitions = _reference_definitions(text, markdown_masked)

    position = 0
    while position + 1 < len(markdown_masked):
        if (
            markdown_masked[position : position + 2] != "!["
            or _is_escaped(text, position)
        ):
            position += 1
            continue
        alt_result = _parse_bracket(text, markdown_masked, position + 1)
        if alt_result is None:
            position += 2
            continue
        alt, alt_closing = alt_result
        following = alt_closing + 1

        if following < len(markdown_masked) and markdown_masked[following] == "(":
            destination = _destination(
                text,
                markdown_masked,
                following + 1,
                allow_leading_newline=True,
            )
            if destination is not None:
                target, destination_end = destination
                image_end = _inline_image_end(markdown_masked, destination_end)
                if image_end is not None:
                    references.append(
                        MarkdownImageReference(alt, target, position, image_end)
                    )
                    position = image_end
                    continue
        elif following < len(markdown_masked) and markdown_masked[following] == "[":
            label_result = _parse_bracket(text, markdown_masked, following)
            if label_result is not None:
                label, label_closing = label_result
                target = definitions.get(normalized_reference_label(label or alt))
                if target is not None:
                    references.append(
                        MarkdownImageReference(alt, target, position, label_closing + 1)
                    )
                    position = label_closing + 1
                    continue
        else:
            target = definitions.get(normalized_reference_label(alt))
            if target is not None:
                references.append(
                    MarkdownImageReference(alt, target, position, alt_closing + 1)
                )
                position = alt_closing + 1
                continue
        position = alt_closing + 1

    for start, end in raw_tags:
        attributes = _raw_attributes(text[start:end])
        alt = attributes.get("alt", "")
        if "src" in attributes:
            references.append(
                MarkdownImageReference(
                    alt,
                    attributes["src"],
                    start,
                    end,
                )
            )
        if "srcset" in attributes:
            references.append(
                MarkdownImageReference(
                    alt,
                    attributes["srcset"],
                    start,
                    end,
                    "srcset",
                )
            )

    unique: dict[tuple[int, int, str, str], MarkdownImageReference] = {}
    for reference in references:
        unique.setdefault(
            (
                reference.offset,
                reference.end,
                reference.target,
                reference.source_attribute,
            ),
            reference,
        )
    return sorted(unique.values(), key=lambda reference: reference.offset)
