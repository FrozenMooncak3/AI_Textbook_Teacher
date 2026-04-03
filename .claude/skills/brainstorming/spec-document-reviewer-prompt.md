# Spec Deep Review — Agent Prompt Template

Use this template when dispatching the spec review agent in brainstorming Step 7.

**Purpose:** Verify the spec against actual code and architecture, not just surface-level formatting.

**Key difference from old approach:** The reviewer gets full project context (architecture.md + related source code), not just the spec file. This catches interface mismatches, missing files in change lists, and data flow breaks.

## How to Build the Prompt

Before dispatching, the brainstorming session (main Claude) must:

1. Identify all source files referenced in the spec's change list
2. Identify architecture.md interface contracts relevant to the spec
3. Include these file paths in the agent prompt below

## Agent Prompt Template

```
Task tool (general-purpose):
  description: "Deep review spec"
  prompt: |
    You are a spec reviewer with full project context. Your job is to find
    real problems that would cause bugs or wasted work during implementation.

    ## Files to Read (in this order)

    1. **Spec to review:** {SPEC_FILE_PATH}
    2. **Architecture contracts:** docs/architecture.md
    3. **Project status:** docs/project_status.md
    4. **Source files referenced by spec:**
       {LIST_OF_SOURCE_FILES}

    Read ALL files above before starting the review.

    ## What to Check

    | Dimension | What to Look For |
    |-----------|------------------|
    | Interface consistency | Does the spec assume interfaces that match the actual code? Field names, return types, endpoint paths, DB column names. |
    | Change list completeness | Does the spec list ALL files that need to change? Check for missing downstream files (e.g., spec changes an API but doesn't mention updating architecture.md). |
    | Data flow connectivity | Trace data from source to destination. API response fields → frontend expectations. DB writes → DB reads in other modules. Any breaks? |
    | Cross-module side effects | Does the change affect modules NOT mentioned in the spec? Check architecture.md interface contracts for dependencies. |
    | Internal consistency | Does the spec contradict itself? Step counts, file lists, section references matching. |

    ## Calibration

    - Only flag issues that would cause real problems (bugs, broken interfaces, missing work).
    - Do NOT flag: style, wording, "could be more detailed", minor formatting.
    - For each issue, explain what would go wrong if it's not fixed.

    ## Output Format

    ## Spec Deep Review

    **Status:** APPROVED | ISSUES FOUND

    **Issues (by severity):**
    1. [Critical/Important/Minor] [Dimension] — [specific problem] — [what breaks if not fixed]
    2. ...

    **Verified dimensions:**
    - [Dimension]: confirmed OK, [brief evidence]

    If no issues found, explain which dimensions you verified and how.
```

## Decision Rules (for the brainstorming session)

After the agent returns:

| Result | Action |
|--------|--------|
| Has **Critical** issues | Must fix, then re-dispatch agent for another round |
| Has **Important** issues | Show to user, user decides what to fix |
| Only **Minor** issues | List them but don't block — proceed |
| **APPROVED** | Proceed to user review gate |
| **3 rounds exhausted** | Stop loop, surface all remaining issues to user for decision |
