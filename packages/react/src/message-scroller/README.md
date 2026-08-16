# MessageScroller

Headless scroll container for chat transcripts. Owns scroll position, anchoring,
auto-follow, and visibility tracking so message components can stay presentational.

## Usage

```tsx
import {
  MessageScroller,
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller"

;<MessageScroller.Provider autoScroll>
  <MessageScroller.Root>
    <MessageScroller.Viewport>
      <MessageScroller.Content>
        <MessageScroller.Item messageId="m1" scrollAnchor>
          …
        </MessageScroller.Item>
      </MessageScroller.Content>
    </MessageScroller.Viewport>
    <MessageScroller.Button />
  </MessageScroller.Root>
</MessageScroller.Provider>
```

## Exports

All from `@shadcn/react/message-scroller`.

### Parts

| Part                       | Role                                                                       | Notable props                                                                                          |
| -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `MessageScroller.Provider` | Headless root; owns scroll state, anchoring, auto-follow, and visibility   | `autoScroll`, `defaultScrollPosition`, `scrollPreviousItemPeek`, `scrollMargin`, `scrollEdgeThreshold` |
| `MessageScroller.Root`     | Styled frame; lays out the viewport, content, and controls in the provider | —                                                                                                      |
| `MessageScroller.Viewport` | Scrollable frame                                                           | `preserveScrollOnPrepend`                                                                              |
| `MessageScroller.Content`  | Message list; defaults `role="log"` + `aria-relevant="additions"`          | —                                                                                                      |
| `MessageScroller.Item`     | One message wrapper                                                        | `messageId`, `scrollAnchor`                                                                            |
| `MessageScroller.Button`   | Scroll-to-end/start affordance; auto-hides when caught up                  | `direction`                                                                                            |

Only an `Item` is a message. Anything else rendered in `Content` — a loading
row, an empty state, a failed fetch's retry card — is drawn and measured, so it
takes up its room, but it is not counted as a row, never anchored to, and never
spends `defaultScrollPosition`. A thread that opens on a placeholder therefore
opens at its `defaultScrollPosition` when the messages arrive.

`defaultScrollPosition` is applied once, on the first render where there is a
scroll range to apply it to. A thread shorter than its viewport is already
showing every position at once, so it does not count: a last message whose
height arrives with a load — a video, an image, a card that measures itself —
opens where it was asked to once that load makes the thread overflow.

### Hooks (flat siblings)

| Hook                             | Returns                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `useMessageScroller()`           | `{ scrollToMessage, scrollToStart, scrollToEnd, releaseAutoScroll }`                     |
| `useMessageScrollerScrollable()` | `MessageScrollerScrollable` — `{ start, end }`, the edges the viewport can scroll toward |
| `useMessageScrollerVisibility()` | `MessageScrollerVisibilityState` — `currentAnchorId`, `visibleMessageIds`                |

### Types

| Type                                   | Meaning                                                               |
| -------------------------------------- | --------------------------------------------------------------------- |
| `MessageScrollerScrollable`            | result of `useMessageScrollerScrollable()`                            |
| `MessageScrollerVisibilityState`       | result of `useMessageScrollerVisibility()`                            |
| `MessageScrollerScrollOptions`         | options for the scroll commands (`align`, `behavior`, `scrollMargin`) |
| `MessageScrollerScrollAlign`           | `"start" \| "center" \| "end" \| "nearest"`                           |
| `MessageScrollerDefaultScrollPosition` | `"start" \| "end" \| "last-anchor"`                                   |

## Tests

| File                                     | Environment | Covers                                                                     |
| ---------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `geometry.test.ts`                       | jsdom       | Geometry math with stubbed rects.                                          |
| `message-scroller.browser.test.tsx`      | chromium    | Behavior jsdom can't model (native scroll anchoring, prepend, visibility). |
| `message-scroller.perf.browser.test.tsx` | chromium    | Performance benchmark + regression guard.                                  |

```bash
pnpm test            # unit (jsdom)
pnpm test:browser    # behavior + performance (chromium)
```
