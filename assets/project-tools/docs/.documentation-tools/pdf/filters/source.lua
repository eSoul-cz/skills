local project_root = assert(os.getenv("DOCUMENTATION_PROJECT_ROOT"), "missing project root")
local source_dir = assert(os.getenv("DOCUMENTATION_SOURCE_DIR"), "missing source directory")
local staging_dir = assert(os.getenv("DOCUMENTATION_STAGING_DIR"), "missing staging directory")
local heading_map_path = assert(os.getenv("DOCUMENTATION_HEADING_MAP"), "missing heading map")
local internal_token = assert(os.getenv("DOCUMENTATION_INTERNAL_TOKEN"), "missing renderer token")
local mermaid_config = assert(os.getenv("DOCUMENTATION_MERMAID_CONFIG"), "missing Mermaid config")
local heading_map = assert(loadfile(heading_map_path))()

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
      "image-" .. pandoc.sha1(resolved) .. ".png",
    })
    pandoc.pipe("convert", {resolved, "-depth", "8", "-strip", output}, "")
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
      output:insert(pandoc.Para({
        pandoc.Image({pandoc.Str(alt)}, image, "", pandoc.Attr("", {}, {width = "95%"})),
      }))
      index = index + 2
    else
      output:insert(current)
      index = index + 1
    end
  end
  return output
end
