#!/usr/bin/env node
// PreToolUse guard for the Agent/Task tool: keeps subagents off the main session's model.
// Denies Explore, forks and general-purpose agents without an explicit model. Everything
// else (and any unexpected input) is allowed, so the guard never blocks real work by accident.
// Disable with ESOUL_AGENT_GUARD=off.
import { readFileSync } from 'node:fs';

function deny(reason) {
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
        },
    }));
}

if (process.env.ESOUL_AGENT_GUARD !== 'off') {
    let input = {};
    try {
        input = JSON.parse(readFileSync(0, 'utf8')) ?? {};
    } catch {
        // Unparsable input: fail open.
    }
    const args = input.tool_input;
    if (args && typeof args === 'object') {
        const type = typeof args.subagent_type === 'string' ? args.subagent_type.trim() : '';
        const model = typeof args.model === 'string' ? args.model.trim() : '';
        if (type === 'Explore') {
            deny('Explore runs on the main session\'s model. Use subagent_type "esoul-skills:scout" with the same prompt (read-only search on Haiku).');
        } else if (type === 'fork') {
            deny('A fork copies the whole conversation and runs on the main model. Start a named agent (esoul-skills:*) with a self-contained brief instead.');
        } else if ((type === '' || type === 'general-purpose' || type === 'claude') && !model) {
            deny('Pass an explicit model: model "haiku" for search and runs, "sonnet" for implementation and review. Or use an esoul-skills:* agent, which pins its own model.');
        }
    }
}
