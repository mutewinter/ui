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

A thread with no `Item` at all — one component drawing the whole transcript
flat — is a thread with no anchors rather than a thread with no content, and it
still opens where it was asked to.

`defaultScrollPosition` is owed to the reader until something happens that the
placement should defer to, and re-applied as the thread settles under it. A
thread reaches its final height in its own time: a video or an image whose box
is settled by a load, a font swapping in, a section that measures itself and
un-clamps a frame later. Each of those is a height the position was computed
against and is now wrong by, and a thread can overflow its viewport and still
be growing, so a scroll range existing is not the thread having settled.

What ends it is an event, not a measurement: the reader scrolling (or anything
routed through `releaseAutoScroll`), a row arriving or leaving, or
`scrollToMessage`. Growth with the same rows is the thread still settling, and
the position is re-applied over it.

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
