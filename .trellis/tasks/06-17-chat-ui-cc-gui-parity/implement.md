# Chat UI cc-gui parity - Implementation Plan

## Phase 0 - Planning and Baseline

- [x] Create Trellis child task under `06-16-chat`.
- [x] Capture requirements in `prd.md`.
- [x] Capture technical design in `design.md`.
- [x] Review/approve this plan before starting source-code implementation.
- [x] Record baseline screenshots or short notes for current Chat page empty state, streaming text, tool call and error display.

## Phase 1 - Message list and message item shell

Goal: replace the visible transcript shell with cc-gui-like IDE document flow while preserving current data contracts.

- [x] Create `src/components/chat/MessageList.tsx`.
  - [x] Props use current `ChatMessage[]` model.
  - [x] Filter renderable messages with `shouldRenderChatMessage`.
  - [x] Implement recent-message window and reveal-earlier behavior.
  - [x] Render a real `<button>` for collapsed earlier messages.
  - [x] Preserve `messagesEndRef` or equivalent bottom anchor behavior.
- [x] Create `src/components/chat/MessageItem.tsx`.
  - [x] Support user, assistant and error visual variants.
  - [x] Use `getRenderableContentBlocks` for structured messages.
  - [x] Use `ContentBlockRenderer` and current `findToolResult` contract for tool output.
  - [x] Use `MarkdownBlock` for plain text fallback.
  - [x] Use `MessageMeta` for completed assistant duration/usage.
  - [x] Add per-message copy action with copied feedback timer cleanup.
- [x] Create small helper component(s) only if needed:
  - [x] `WaitingIndicator.tsx`
  - [x] `StreamingPlaceholder.tsx`
  - [x] `MessageActions.tsx`
- [x] Update `src/pages/ChatPage.tsx`.
  - [x] Remove local `MessageBubble` once replacement is wired.
  - [x] Keep SDK modal, permission modal, plan approval and input behavior unchanged.
  - [x] Keep current auto-scroll behavior unless the new list owns it cleanly.
- [x] Add i18n keys for new labels in `zh.json` and `en.json`.

Validation for Phase 1:

- [x] `npm run build`
- [ ] Manual: empty chat state still appears.
- [ ] Manual: user message and assistant streaming text render correctly.
- [ ] Manual: internal tool_result messages are not shown as user messages.
- [ ] Manual: tool blocks still resolve their results.
- [ ] Manual: copy button works and resets copied state.
- [ ] Manual: long transcript can reveal earlier messages.

## Phase 2 - Thinking and streaming polish

Goal: make ongoing assistant response feel like cc-gui rather than a blank bubble.

- [x] Add delayed empty-streaming placeholder for latest assistant message.
  - [x] Show immediate subtle loading indicator.
  - [x] Show connected/waiting hint after roughly 350ms.
  - [x] Clear timer on condition change/unmount.
- [x] Upgrade Thinking behavior.
  - [x] Allow MessageItem-level expansion state per thinking block.
  - [x] Auto-expand latest thinking block during streaming.
  - [x] Preserve user manual expand/collapse decisions.
  - [x] Keep non-streaming thinking blocks collapsed by default unless manually opened.
- [x] Add/adjust i18n strings for thinking and streaming states.

Validation for Phase 2:

- [x] `npm run build`
- [ ] Manual: empty assistant streaming placeholder appears only when appropriate.
- [ ] Manual: latest thinking expands while streaming and older thinking stays manageable.
- [ ] Manual: user manual thinking toggle is not overridden unexpectedly.

## Phase 3 - Markdown rendering parity

Goal: improve Markdown robustness and security without changing component consumers.

- [x] Keep `MarkdownBlock` public props compatible.
- [x] Add cc-gui-inspired safe href sanitizer.
  - [x] Allow relative links, Windows drive paths, `file:`, `http:`, `https:`, `mailto:`.
  - [x] Reject control characters and unsafe schemes such as `javascript:`.
  - [x] Avoid installing duplicate DOMPurify hooks.
- [x] Review syntax language registration and add missing common aliases if needed.
- [x] Preserve streaming code fence auto-close.
- [x] Preserve or improve code-block copy buttons.
- [ ] Optionally add Mermaid lazy rendering if dependency already exists or product approves adding it.

Validation for Phase 3:

- [x] `npm run build`
- [ ] Manual: code block highlighting and copy still work.
- [ ] Manual: dangerous links are removed or neutralized.
- [ ] Manual: Windows path-like links are not incorrectly stripped if supported.
- [ ] Manual: streaming incomplete code fence renders acceptably.

## Phase 4 - Layout extension points

Goal: prepare the Chat page for cc-gui-level navigation and status UX.

- [x] Introduce or reserve slots for:
  - [x] `ConversationSearch`
  - [x] `MessageAnchorRail`
  - [x] `ScrollControl`
  - [x] `StatusPanel`
- [x] Do not fully implement advanced search/anchor behavior unless scoped and reviewed.
- [x] Ensure layout does not regress on small window sizes.
- [x] Polish layout and transcript details after first pass.
  - [x] Show scroll-to-bottom control only when the transcript is away from the bottom.
  - [x] Keep auto-scroll pinned only when the user is near the bottom.
  - [x] Count only renderable messages in the status panel.
  - [x] Treat the final renderable message as the latest message for streaming UI.
  - [x] Add cc-gui-like message rail, hover affordance and streaming status chip.
  - [x] Extract search, anchor rail and status panel into focused chat components.
  - [x] Upgrade reserved conversation search slot into a usable in-session message filter.
  - [x] Scroll to the search result area when a new conversation search starts.
  - [x] Clear conversation search state when clearing the transcript.
  - [x] Add low-risk visual emphasis for messages shown as search matches.
  - [x] Harden Markdown parse-error fallback by escaping raw content before HTML injection.
  - [x] Add IME-safe composer submit so Enter does not send while composing text.

Validation for Phase 4:

- [x] `npm run build`
- [ ] Manual: chat remains usable at narrow and tall/short window sizes.
- [ ] Manual: reserved layout slots do not cover messages or input.

## Phase 5 - Composer follow-up planning

Goal: define the next focused task for cc-gui-like input interaction.

- [x] Decide whether to implement composer enhancements in this task or split to a child task.
- [ ] If split, create a Trellis child task for ChatInputBox parity.
- [x] Include requirements for IME-safe submit, history navigation, slash/file/agent/prompt command entry, paste/drop, resize and send/abort state.
- [x] Implement IME-safe submit guard in `ChatComposer`.
- [x] Implement session-local draft history navigation with ArrowUp/ArrowDown.
- [x] Implement paste/drop file context handling with visible drop feedback.
- [x] Replace fake `@filename` attachment prompts with real image attachment payloads.
  - [x] Read PNG/JPEG/WebP/GIF files from paste/drop/file picker into `ChatAttachment`.
  - [x] Keep Tauri local file paths when the WebView exposes them.
  - [x] Allow attachment-only sends with a provider-safe fallback prompt.
  - [x] Route Claude images through `sendWithAttachments`.
  - [x] Route Codex local paths through SDK `local_image`, and persist Codex base64 images in the bridge before sending.
- [x] Compact the composer default layout.
  - [x] Remove empty file-context placeholder text from the top context bar.
  - [x] Make the textarea default to one row and cap growth at a lower max height.
  - [x] Keep toolbar controls on a single compact row at desktop widths.
  - [x] Keep the composer inside the central conversation column and center it with a bounded max width so it does not span across the session sidebar/status panel.
  - [x] Add a visible resize handle and make drag resize the textarea's actual rendered height, not only its max height.
- [x] Replace click-only reveal-earlier flow with scroll-top auto paging that preserves viewport position after older messages are prepended.
- [x] Extend edit tool summaries with per-file `+/-` counts and hover diff previews backed by shared structured preview lines.
- [x] Fix `@` workspace file completion payload normalization so Rust `rel_path` / `is_dir` does not render undefined candidates.
- [x] Change `!` Prompt preset completion to insert preset content instead of only the preset name.
- [x] Add first-pass Chat session management sidebar.
  - [x] Browse projects with existing `get_dashboard_projects`.
  - [x] Browse supported Claude/Codex sessions with existing `list_sessions`.
  - [x] Search and refresh the selected project's session list.
  - [x] Split the sidebar into independent project/session scroll panes so selected project sessions stay visible instead of being pushed below a long project list.
  - [x] Load selected session history via `get_unified_session_messages`.
  - [x] Continue selected sessions by reusing `sessionId`, provider and project cwd in `chat_send`.
  - [x] Start a new chat using the selected project's cwd.
- [x] Abort an active daemon request before loading history, starting a new chat, or clearing the current chat to avoid old stream events leaking into the next session.
- [x] Add regression coverage for snake_case workspace file completion payloads.
- [x] Add regression coverage for session transition abort behavior.

## Files likely to change

Source files:

- `src/pages/ChatPage.tsx`
- `src/components/chat/MessageList.tsx`
- `src/components/chat/MessageItem.tsx`
- `src/components/chat/WaitingIndicator.tsx`
- `src/components/chat/StreamingPlaceholder.tsx`
- `src/components/chat/ThinkingBlock.tsx`
- `src/components/chat/MarkdownBlock.tsx`
- `src/locales/zh.json`
- `src/locales/en.json`
- `src/stores/useChatStore.ts`
- `src/stores/useChatStore.test.ts`
- `src/components/chat/ChatSessionSidebar.tsx`
- `src/components/chat/composer/useCompletions.ts`
- `src/components/chat/composer/useCompletions.test.ts`

Files to avoid unless necessary:

- `src/stores/useChatStore.ts` - avoid protocol/state changes in UI shell phase; touched in Phase 5 only for session loading/new chat cwd and active-request abort boundaries.
- `src-tauri/src/**` - no backend change expected.
- generated output directories such as `dist/` or `src-tauri/target/`.

## Quality checklist

- [x] No new `any`.
- [x] No unused imports, locals or parameters.
- [x] User-facing strings are i18n-backed in both languages.
- [x] Icon-only buttons have `title` or `aria-label`.
- [x] Timers and event listeners are cleaned up.
- [ ] Dark mode and light mode both reviewed.
- [x] No generated files edited.
- [x] `npm run build` passes before completion.
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` is run if any Rust/Tauri backend file changes.

Latest validation notes:

- [x] `npm test` - 3 files / 11 tests passed.
- [x] `npm run build` - TypeScript and Vite production build passed.
- [x] `git diff --check` - no whitespace errors; only Windows LF-to-CRLF warnings.
- [x] Browser smoke check at `http://127.0.0.1:5173/#/chat` - chat page renders, session sidebar/input/status are visible, `@` input does not render `undefined`, no browser console errors observed.
- [x] Browser layout smoke check after sidebar split - project/session panes render as separate scroll sections; plain Vite browser cannot load real Tauri session data and logs expected `invoke` runtime errors outside the desktop shell.
- [x] Assistant message flow visual pass - `MessageItem` now keeps user messages as compact right-aligned bubbles while assistant messages render in a transparent transcript flow; Markdown heading sizes are capped in user bubbles, and thinking/tool blocks are visually reduced inside assistant flow.
- [x] `npm run build` after assistant flow visual pass - TypeScript and Vite production build passed.
- [x] Composer/image attachment pass - `npm test -- src/stores/useChatStore.test.ts` passed 8 tests; `npm run build` passed; direct Node bridge verification confirmed Codex base64 images persist to a temp file and become `local_image`.
- [x] Composer resize + edit hover diff + history autoload pass - `npm test -- src/utils/chatUiBehavior.test.ts src/utils/toolPresentation.test.ts` passed 13 tests; `npm run build` passed; browser smoke on `http://127.0.0.1:5173/#/chat` confirmed the resize handle renders, textarea height grows from `44px` to `134px` on drag, and no horizontal overflow appears in the centered layout.
- [ ] Desktop Tauri verification with real session data - still needed for selecting an existing session and continuing a message against the daemon.

## Rollback notes

- Phase 1 should keep old rendering logic conceptually replaceable by limiting changes to `ChatPage` wiring and new chat components.
- If message filtering breaks, revert to direct `messages.map` temporarily and debug `shouldRenderChatMessage` integration.
- If Markdown sanitizer causes unexpected content loss, isolate that change from MessageList work and revert only MarkdownBlock changes.
