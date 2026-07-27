local internal_token = assert(os.getenv("DOCUMENTATION_INTERNAL_TOKEN"), "missing renderer token")

local allowed_math_commands = {
  alpha = true, approx = true, bar = true, beta = true, cdot = true,
  cos = true, delta = true, div = true, epsilon = true, exp = true,
  frac = true, gamma = true, ge = true, geq = true, hat = true,
  infty = true, lambda = true, langle = true, le = true, left = true,
  leftarrow = true, leq = true, ln = true, log = true, mathbf = true,
  mathit = true, mathrm = true, max = true, min = true, mp = true,
  mu = true, ne = true, neq = true, omega = true, operatorname = true,
  overline = true, phi = true, pi = true, pm = true, prod = true,
  rangle = true, right = true, rightarrow = true, sigma = true,
  sin = true, sqrt = true, sum = true, tan = true, text = true,
  theta = true, times = true, to = true, underline = true, vec = true,
}

local callout_environments = {
  ["documentation-callout-note"] = "documentationnote",
  ["documentation-callout-tip"] = "documentationtip",
  ["documentation-callout-important"] = "documentationimportant",
  ["documentation-callout-warning"] = "documentationwarning",
  ["documentation-callout-caution"] = "documentationcaution",
  ["documentation-callout-planned"] = "documentationplanned",
}

local function has_class(element, expected)
  for _, class_name in ipairs(element.classes) do
    if class_name == expected then
      return true
    end
  end
  return false
end

function Math(element)
  if element.text:find("^^", 1, true) then
    error("Unsafe TeX math control sequence")
  end
  for command in element.text:gmatch("\\([%a@]+)") do
    if not allowed_math_commands[command] then
      error("Unsafe TeX math command: \\" .. command)
    end
  end
  local without_commands = element.text:gsub("\\[%a@]+", "")
  if without_commands:find("\\", 1, true) then
    error("Unsafe TeX math control sequence")
  end
  return nil
end

function Div(element)
  if element.attributes["data-documentation-token"] ~= internal_token then
    return nil
  end
  element.attributes["data-documentation-token"] = nil
  if has_class(element, "documentation-page-break") then
    return pandoc.RawBlock("latex", "\\newpage")
  end
  if has_class(element, "documentation-landscape") then
    local blocks = {pandoc.RawBlock("latex", "\\begin{landscape}")}
    for _, block in ipairs(element.content) do
      blocks[#blocks + 1] = block
    end
    blocks[#blocks + 1] = pandoc.RawBlock("latex", "\\end{landscape}")
    return blocks
  end
  for class_name, environment in pairs(callout_environments) do
    if has_class(element, class_name) then
      local blocks = {pandoc.RawBlock("latex", "\\begin{" .. environment .. "}")}
      for _, block in ipairs(element.content) do
        blocks[#blocks + 1] = block
      end
      blocks[#blocks + 1] = pandoc.RawBlock("latex", "\\end{" .. environment .. "}")
      return blocks
    end
  end
  return nil
end
