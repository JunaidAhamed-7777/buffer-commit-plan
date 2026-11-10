---
version: alpha
name: Patchwork
description: A copy desk for changing exact phrases across Buffer drafts.
colors:
  paper: "#F5F4F0"
  sheet: "#FFFEFA"
  wash: "#EFEEE8"
  ink: "#23261F"
  muted: "#5F665C"
  rule: "#D9DBD1"
  primary: "#2548B9"
  primary-dark: "#1C3791"
  primary-wash: "#E8EEFF"
  success: "#235D3B"
  success-wash: "#E9F3E9"
  danger: "#8D312E"
  danger-wash: "#F8EBE8"
  warning: "#76500C"
  warning-wash: "#FBF2D9"
typography:
  sans:
    fontFamily: "Geist, Segoe UI, sans-serif"
  mono:
    fontFamily: "Geist Mono, Consolas, monospace"
rounded:
  sm: "5px"
  md: "8px"
  lg: "11px"
spacing:
  desktop-column-gap: "27px"
  draft-stack-gap: "11px"
  page-max: "1320px"
components:
  workspace:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
  fact-choice-selected:
    backgroundColor: "{colors.primary-wash}"
    textColor: "{colors.primary-dark}"
  fact-choice-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.muted}"
  draft-sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.md}"
  divider:
    backgroundColor: "{colors.rule}"
  patch-add:
    backgroundColor: "{colors.success-wash}"
    textColor: "{colors.success}"
  patch-remove:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger}"
  review-warning:
    backgroundColor: "{colors.warning-wash}"
    textColor: "{colors.warning}"
  dialog:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.lg}"
---

# Patchwork design

## Overview

Patchwork takes its cues from a copy editor's proof sheet. Each draft has a margin for its channel and link count. A blue underline and highlight identify exactly which words are tied to the selected fact. The surrounding draft remains plain so the editor can check the change in context.

This English-language workbench serves a solo creator repairing details after drafting a campaign. Campaign, Review and Receipts share the same layout and vocabulary. The product behavior lives in the [specification](docs/product/specification.md), [experience plan](docs/product/experience-and-demo.md) and [write protocol](docs/engineering/architecture.md).

The [application stylesheet](src/app/globals.css) owns runtime tokens. The frontmatter mirrors its shared values. `primary`, `success`, `danger` and `warning` correspond to `--blue`, `--green`, `--red` and `--amber`. The layout bundles Geist locally.

## Colors

Warm paper separates the workspace from the lighter draft sheets. Blue identifies selection, keyboard focus and the primary action. Red and green identify removed and added text and always appear with text labels. Amber marks an item that needs attention. Keep the root scrollbar visible and let forced colors use the browser palette.

## Typography

Use Geist for controls, headings and draft prose. Reserve Geist Mono for draft numbers, exact replacements and identifiers. Keep copy at a readable measure and allow long names, links and draft text to wrap. Preserve spaces and line breaks in previews.

## Layout

The desktop campaign has a narrow fact rail and a wider stack of draft sheets. The review keeps that split for the selected scope and the proposed edits. At 760px the rails stack and navigation moves to a second row. At 500px the draft margin moves above the text. Page content scrolls naturally. Occurrence results, draft pickers and dialogs use bounded scrolling.

## Elevation & Depth

Separate sheets with borders and a light tone in the draft margin. The modal is the sole elevated surface. Keep progress and errors in the relevant panel, above the actions that can resolve them.

## Shapes

Use 5px control corners, 8px sheet corners and 11px dialog corners. The active fact adds a blue rule to the edge of its row. Preserve enough padding around a focused control for the focus ring.

## Components

- **Actions** use a blue fill for the primary next step, a light border for secondary actions and an underlined hover for text actions. Disabled actions use muted text on a neutral fill. A spinner accompanies the existing label during a request.
- **Inputs** use native fields and labels. Organization selection uses the platform's native select popup. Exact phrase search has its own clear button and a radio group for duplicate occurrences.
- **Dialogs** use the native dialog element with an app-owned layout. Focus starts on the safer action and returns to the trigger when it closes.
- **Status** uses a label and Lucide icon. Receipts stay visible and explain the next available action. Motion is limited to the loading indicator and a brief press state, both suppressed when reduced motion is requested.

## Do's and Don'ts

- Put the exact edit beside the text it affects.
- Use the same verbs throughout a workflow. A person reviews a change, applies the chosen drafts and checks the receipt.
- Keep sample mode visible throughout the sample workflow.
- Keep decorative imagery and campaign analytics out of the editing surface.
