local project_root = assert(os.getenv("DOCUMENTATION_PROJECT_ROOT"), "missing project root")
local source_dir = assert(os.getenv("DOCUMENTATION_SOURCE_DIR"), "missing source directory")
local staging_dir = assert(os.getenv("DOCUMENTATION_STAGING_DIR"), "missing staging directory")
local heading_map_path = assert(os.getenv("DOCUMENTATION_HEADING_MAP"), "missing heading map")
local internal_token = assert(os.getenv("DOCUMENTATION_INTERNAL_TOKEN"), "missing renderer token")
local mermaid_config = assert(os.getenv("DOCUMENTATION_MERMAID_CONFIG"), "missing Mermaid config")
local cross_document_links = os.getenv("DOCUMENTATION_CROSS_DOCUMENT_LINKS") or "error"
local heading_map = assert(loadfile(heading_map_path))()
local link_notice_style = os.getenv("DOCUMENTATION_LINK_NOTICE_STYLE") or "plain"
local link_notice_map_path = os.getenv("DOCUMENTATION_LINK_NOTICE_MAP")
local source_path = os.getenv("DOCUMENTATION_SOURCE_PATH")
local link_notice_map = {}
if link_notice_map_path ~= nil then
  link_notice_map = assert(loadfile(link_notice_map_path))()
end
local link_notices = link_notice_map[source_path] or {}

local raster_suffixes = {
  [".jpeg"] = true,
  [".jpg"] = true,
  [".png"] = true,
  [".tif"] = true,
  [".tiff"] = true,
  [".webp"] = true,
}

local callout_types = {
  NOTE = "note",
  TIP = "tip",
  IMPORTANT = "important",
  WARNING = "warning",
  CAUTION = "caution",
}

local function file_exists(path)
  local handle = io.open(path, "rb")
  if handle == nil then
    return false
  end
  handle:close()
  return true
end

local function file_cache_key(path)
  local handle, open_error = io.open(path, "rb")
  if handle == nil then
    error("Cannot read image target in PDF rendering: " .. path .. ": " .. tostring(open_error))
  end
  local contents, read_error = handle:read("*a")
  handle:close()
  if contents == nil then
    error("Cannot read image target in PDF rendering: " .. path .. ": " .. tostring(read_error))
  end
  return pandoc.sha1(path .. "\0" .. pandoc.sha1(contents))
end

local function percent_decode(value)
  return (value:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end))
end

local function is_external(target)
  return target:match("^[%a][%w+.-]*:") ~= nil or target:match("^//") ~= nil
end

local function split_target(target)
  local before_fragment, fragment = target:match("^([^#]*)#?(.*)$")
  local path, query = before_fragment:match("^([^?]*)%??(.*)$")
  return path or "", query or "", fragment or ""
end

local function normalized_local(target)
  if is_external(target) then
    return nil
  end
  local path = split_target(target)
  path = percent_decode(path)
  if path == "" or pandoc.path.is_absolute(path) then
    return nil
  end
  local resolved = pandoc.path.normalize(pandoc.path.join({source_dir, path}))
  if resolved ~= project_root and resolved:sub(1, #project_root + 1) ~= project_root .. "/" then
    error("Local target escapes project root: " .. target)
  end
  return resolved
end

local function suffix(path)
  return (path:match("(%.[^./]+)$") or ""):lower()
end

local function literal_inlines(value)
  local inlines = pandoc.Inlines({})
  local first = true
  for word in value:gmatch("%S+") do
    if not first then
      inlines:insert(pandoc.Space())
    end
    inlines:insert(pandoc.Str(word))
    first = false
  end
  return inlines
end

local function annotate_link(element, target)
  local output = pandoc.Inlines({})
  for _, inline in ipairs(element.content) do
    output:insert(inline)
  end
  if link_notice_style == "plain" then
    output:insert(pandoc.Space())
    for _, inline in ipairs(literal_inlines(target)) do
      output:insert(inline)
    end
  elseif link_notice_style == "parentheses" then
    output:insert(pandoc.Space())
    output:insert(pandoc.Str("("))
    for _, inline in ipairs(literal_inlines(target)) do
      output:insert(inline)
    end
    output:insert(pandoc.Str(")"))
  elseif link_notice_style == "footnote" then
    output:insert(pandoc.Note({
      pandoc.Para(literal_inlines(target)),
    }))
  end
  return output
end

local function normalize_image(element)
  local target = element.src
  if element.attributes.srcset ~= nil then
    error("HTML srcset images are not permitted in PDF rendering")
  end
  if target:lower():match("^data:") then
    error("Embedded image data is not permitted in PDF rendering")
  end
  if is_external(target) then
    error("Remote image targets are not permitted in PDF rendering: " .. target)
  end
  local target_path = split_target(target)
  if target_path == "" or pandoc.path.is_absolute(percent_decode(target_path)) then
    error("Absolute or empty image targets are not permitted in PDF rendering: " .. target)
  end
  local resolved = normalized_local(target)
  if resolved == nil or not file_exists(resolved) then
    error("Image target does not exist in PDF rendering: " .. target)
  end
  if raster_suffixes[suffix(resolved)] then
    local output = pandoc.path.join({
      staging_dir,
      "image-" .. file_cache_key(resolved) .. ".png",
    })
    if not file_exists(output) then
      pandoc.pipe("convert", {resolved, "-depth", "8", "-strip", output}, "")
    end
    element.src = output
    if element.attributes.width == nil then
      element.attributes.width = "95%"
    end
  else
    element.src = resolved
  end
  return element
end

function Image(element)
  return normalize_image(element)
end

function Link(element)
  local target = element.target
  if link_notices[target] ~= nil then
    return annotate_link(element, link_notices[target])
  end
  if is_external(target) then
    return nil
  end
  local path, query, fragment = split_target(target)
  if path == "" then
    return nil
  end
  local resolved = normalized_local(target)
  if resolved == nil then
    return nil
  end
  if path:lower():match("%.md$") and heading_map[resolved] ~= nil then
    local anchor = heading_map[resolved]
    if fragment ~= "" then
      local fragment_document = pandoc.read(
        "# " .. percent_decode(fragment),
        "markdown"
      )
      if fragment_document.blocks[1] ~= nil
          and fragment_document.blocks[1].t == "Header" then
        anchor = fragment_document.blocks[1].identifier
      end
    end
    element.target = "#" .. anchor
  elseif path:lower():match("%.md$") then
    if cross_document_links == "notice" then
      return element.content
    end
    error("Markdown link target is not part of the rendered guide: " .. target)
  elseif file_exists(resolved) then
    element.target = resolved
      .. (query ~= "" and "?" .. query or "")
      .. (fragment ~= "" and "#" .. fragment or "")
  end
  return element
end

local function raw_html_image(element)
  if element.format ~= "html" or not element.text:lower():match("^%s*<img%s") then
    return nil
  end
  if element.text:lower():match("%ssrcset%s*=") then
    error("HTML srcset images are not permitted in PDF rendering")
  end
  local document = pandoc.read(element.text, "html")
  local image
  document:walk({
    Image = function(candidate)
      if image == nil then
        image = normalize_image(candidate)
      end
    end,
  })
  return image
end

function RawInline(element)
  return raw_html_image(element)
end

function RawBlock(element)
  local image = raw_html_image(element)
  if image ~= nil then
    return pandoc.Para({image})
  end
  return nil
end

function BlockQuote(element)
  local first = element.content[1]
  if first == nil or (first.t ~= "Para" and first.t ~= "Plain") then
    return nil
  end
  local marker = first.content[1]
  if marker == nil then
    return nil
  end
  local callout
  if marker.t == "Str" then
    local alert = marker.text:match("^%[!(%u+)%]$")
    callout = callout_types[alert]
  elseif marker.t == "Strong" and pandoc.utils.stringify(marker) == "Planned" then
    callout = "planned"
  end
  if callout == nil then
    return nil
  end
  table.remove(first.content, 1)
  if first.content[1] ~= nil
      and (first.content[1].t == "SoftBreak" or first.content[1].t == "LineBreak") then
    table.remove(first.content, 1)
  end
  if #first.content == 0 then
    table.remove(element.content, 1)
  end
  return pandoc.Div(
    element.content,
    pandoc.Attr(
      "",
      {"documentation-callout-" .. callout},
      {["data-documentation-token"] = internal_token}
    )
  )
end

function Blocks(blocks)
  local output = pandoc.Blocks({})
  local index = 1
  while index <= #blocks do
    local current = blocks[index]
    local following = blocks[index + 1]
    local alt
    if current ~= nil and current.t == "RawBlock" and current.format == "html" then
      alt = current.text:match("^<!%-%-%s*diagram%-alt:%s*(.-)%s*%-%->$")
    end
    if alt ~= nil
        and following ~= nil
        and following.t == "CodeBlock"
        and (function()
          for _, class_name in ipairs(following.classes) do
            if class_name == "mermaid" then
              return true
            end
          end
          return false
        end)() then
      local digest = pandoc.sha1(following.text)
      local input = pandoc.path.join({staging_dir, "diagram-" .. digest .. ".mmd"})
      local image = pandoc.path.join({staging_dir, "diagram-" .. digest .. ".pdf"})
      local handle = assert(io.open(input, "wb"))
      handle:write(following.text)
      handle:write("\n")
      handle:close()
      pandoc.pipe("merman-cli", {
        "--input", input,
        "--output", image,
        "--outputFormat", "pdf",
        "--pdfFit",
        "--backgroundColor", "transparent",
        "--configFile", mermaid_config,
      }, "")
      local image_alt = literal_inlines(alt)
      local caption = pandoc.Caption({
        pandoc.Plain(literal_inlines(alt)),
      })
      output:insert(pandoc.Figure({
        pandoc.Plain({
          pandoc.Image(
            image_alt,
            image,
            "",
            pandoc.Attr("", {}, {width = "95%"})
          ),
        }),
      }, caption))
      index = index + 2
    else
      output:insert(current)
      index = index + 1
    end
  end
  return output
end
