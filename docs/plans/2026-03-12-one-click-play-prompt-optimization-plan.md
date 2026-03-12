# 2026-03-12 One-Click Play Prompt Optimization Plan

## Goal

Upgrade the GameClaw README prompt so that when a user pastes it into their own agent, the agent is much more likely to understand that:
- the games are for the agent / user to actually play now
- it should determine the local platform automatically when possible
- it should fetch the correct release asset proactively
- it should present a numbered game menu to the human
- after the human replies with a number, it should launch into the selected game flow instead of staying in explanation mode

## Scope

- rewrite the copy-paste prompt in `README.md`
- rewrite the corresponding Chinese prompt in `README.zh-CN.md`
- make the prompt more imperative, agent-operational, and gameplay-oriented
- preserve alignment with the current GameClaw catalog and release reality
- keep the README overall minimal and AI-native

## Assumptions

- current public game catalog only includes `lobster-cli-roguelike`
- currently supported release assets are `linux-x86_64` and `darwin-arm64`
- the target environment is an agent that can inspect local platform and can help the user obtain/run release binaries
- if the agent cannot directly execute on the user machine, it should still behave as if it owns the flow: detect, fetch, present numbered choices, and guide the user through the minimal next action

## Risks

- over-specifying tool behavior may make the prompt brittle across agents with different toolsets
- if the prompt sounds too much like policy, some agents may summarize it instead of following it
- a too-strong “auto play” wording could cause some agents to act without clarifying permissions in environments that require confirmation

## Checklist

- [x] Inspect current README prompts and identify why they are staying in explanation mode
- [x] Rewrite the English prompt to be more action-driving and agent-centric
- [x] Rewrite the Chinese prompt to match the improved interaction design
- [x] Ensure the prompt explicitly asks for platform auto-detection, numbered menu presentation, asset fetching, and immediate play flow after numeric selection
- [x] Validate the updated prompt against current GameClaw release/catalog reality
- [ ] Commit the prompt optimization
- [ ] Push to GitHub
