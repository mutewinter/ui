import * as React from "react"
import { flushSync } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, test } from "vitest"

import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerVisibility,
} from "."

const MessageScrollerProvider = MessageScrollerPrimitive.Provider
const MessageScroller = MessageScrollerPrimitive.Root
const MessageScrollerViewport = MessageScrollerPrimitive.Viewport
const MessageScrollerContent = MessageScrollerPrimitive.Content
const MessageScrollerItem = MessageScrollerPrimitive.Item
const MessageScrollerButton = MessageScrollerPrimitive.Button

// Real-browser regression for the prepend double-compensation bug. In Chromium
// native scroll anchoring shifts scrollTop on prepend; the component's restore
// must NOT compensate again. This is invisible to jsdom: with no native
// anchoring there, the viewport-relative and content-relative measurements
// produce the same number, so the bug and the fix look identical. Only a real
// engine with scroll anchoring can tell them apart.

// This component is driven by the event loop — requestAnimationFrame,
// ResizeObserver, IntersectionObserver — none of which act() can wrap. The suite
// flushes renders synchronously with flushSync and settles the async scroll work
// on real frames via settle(), so it runs OUTSIDE the act environment that
// vitest.browser.setup.ts enables globally (vitest isolates files, so other
// suites keep it on). Without this, the rAF-driven visibility subscriber logs
// spurious "not wrapped in act" warnings even though the assertions, which read
// only after settle(), are correct.

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = false

const ITEM_HEIGHT = 80
const VIEWPORT_HEIGHT = 200
const DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK = 64

type TestItem = {
  height?: number
  id: string
  scrollAnchor?: boolean
  // Rows carrying text take their height from how the text wraps, so a change
  // of viewport width reflows them the way real message content does.
  text?: string
}

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  root?.unmount()
  container?.remove()
  root = null
  container = null
})

function Thread({
  autoScroll,
  defaultScrollPosition,
  items,
  placeholder,
  scrollPreviousItemPeek,
  showButton = false,
  showJumpButton = false,
  showReleaseButton = false,
  showVisibility = false,
  viewportWidth,
}: {
  autoScroll?: boolean
  defaultScrollPosition?: React.ComponentProps<
    typeof MessageScrollerProvider
  >["defaultScrollPosition"]
  items: TestItem[]
  /** Height of a row the caller drew that is not a message, e.g. a spinner. */
  placeholder?: number
  scrollPreviousItemPeek?: number
  showButton?: boolean
  showJumpButton?: boolean
  showReleaseButton?: boolean
  showVisibility?: boolean
  viewportWidth?: number
}) {
  return (
    <MessageScrollerProvider
      autoScroll={autoScroll}
      defaultScrollPosition={defaultScrollPosition}
      scrollPreviousItemPeek={scrollPreviousItemPeek}
    >
      <MessageScroller>
        <MessageScrollerViewport
          aria-label="viewport"
          style={{
            height: VIEWPORT_HEIGHT,
            overflowY: "auto",
            width: viewportWidth,
          }}
        >
          <MessageScrollerContent
            style={{ display: "flex", flexDirection: "column" }}
          >
            {placeholder === undefined ? null : (
              <div style={{ height: placeholder, flex: "none" }}>Loading</div>
            )}
            {items.map((item) => (
              <MessageScrollerItem
                key={item.id}
                messageId={item.id}
                scrollAnchor={item.scrollAnchor}
                style={
                  item.text
                    ? { flex: "none" }
                    : { height: item.height ?? ITEM_HEIGHT, flex: "none" }
                }
              >
                {item.text ?? item.id}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        {showButton ? (
          <MessageScrollerButton behavior="auto">
            Scroll to end
          </MessageScrollerButton>
        ) : null}
        {showJumpButton ? <JumpButton messageId="m5" /> : null}
        {showReleaseButton ? <ReleaseButton /> : null}
        {showVisibility ? <VisibilityProbe /> : null}
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function VisibilityProbe() {
  const { currentAnchorId, visibleMessageIds } = useMessageScrollerVisibility()

  return (
    <div
      data-testid="visibility"
      data-current-anchor={currentAnchorId ?? ""}
      data-visible={visibleMessageIds.join(",")}
    />
  )
}

const MemoMessageItem = React.memo(function MemoMessageItem({
  id,
  anchor,
}: {
  id: string
  anchor: boolean
}) {
  return (
    <MessageScrollerItem
      messageId={id}
      scrollAnchor={anchor}
      style={{ height: ITEM_HEIGHT, flex: "none" }}
    >
      {id}
    </MessageScrollerItem>
  )
})

function JumpButton({ messageId }: { messageId: string }) {
  const { scrollToMessage } = useMessageScroller()

  return (
    <button
      type="button"
      onClick={() => {
        scrollToMessage(messageId, { align: "start", behavior: "auto" })
      }}
    >
      Jump to message
    </button>
  )
}

function ReleaseButton() {
  const { releaseAutoScroll } = useMessageScroller()

  return (
    <button
      data-testid="release"
      type="button"
      onClick={() => {
        releaseAutoScroll()
      }}
    >
      Release auto scroll
    </button>
  )
}

// Resolve after a few real animation frames so the component's rAF-scheduled
// scroll work and the browser's native anchoring both settle.
function settle(frames = 4) {
  return new Promise<void>((resolve) => {
    let remaining = frames
    const tick = () =>
      remaining-- <= 0 ? resolve() : requestAnimationFrame(tick)
    requestAnimationFrame(tick)
  })
}

function viewportOffsetOf(messageId: string, viewport: HTMLElement) {
  const item = document.querySelector(
    `[data-message-id="${messageId}"]`
  ) as HTMLElement
  return Math.round(
    item.getBoundingClientRect().top - viewport.getBoundingClientRect().top
  )
}

function getViewport() {
  return document.querySelector('[aria-label="viewport"]') as HTMLElement
}

function getDistanceToBottom(viewport: HTMLElement) {
  return Math.round(
    viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
  )
}

function getScrollTop(viewport: HTMLElement) {
  return Math.round(viewport.scrollTop)
}

// A reader's own scroll: the intent gesture, then the move it causes, clamped by
// the browser the way a real wheel is.
function scrollByGesture(viewport: HTMLElement, delta: number) {
  viewport.dispatchEvent(
    new WheelEvent("wheel", { bubbles: true, deltaY: delta })
  )
  viewport.scrollTop += delta
  viewport.dispatchEvent(new Event("scroll", { bubbles: true }))
}

function getTailSpacer() {
  const spacer = document.querySelector<HTMLElement>(
    "[data-message-scroller-spacer]"
  )!

  return spacer.hidden ? 0 : Math.round(Number.parseFloat(spacer.style.height))
}

function getCurrentAnchor() {
  return document
    .querySelector('[data-testid="visibility"]')!
    .getAttribute("data-current-anchor")
}

function getVisibleIds() {
  const value =
    document
      .querySelector('[data-testid="visibility"]')!
      .getAttribute("data-visible") ?? ""
  return value ? value.split(",") : []
}

async function renderThread({
  zoom,
  ...props
}: React.ComponentProps<typeof Thread> & { zoom?: number }) {
  container = document.createElement("div")

  if (zoom !== undefined) {
    container.style.zoom = String(zoom)
  }

  document.body.appendChild(container)
  root = createRoot(container)
  flushSync(() => {
    root!.render(<Thread {...props} />)
  })
  await settle()
}

function createItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
  }))
}

// Rows of prose rather than fixed boxes, so their height is a function of the
// width they are given and narrowing the viewport reflows the whole transcript.
function createWrappingItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    text: `Message ${index}. ${"The quick brown fox jumps over the lazy dog. ".repeat(4)}`,
  }))
}

test("keeps the visible message in place when older messages are prepended", async () => {
  const initial = createItems(8)

  await renderThread({ items: initial })

  const viewport = getViewport()

  // Scroll into the middle so there is content above and below; m3 lands at the
  // top of the viewport and becomes the preserved anchor.
  viewport.scrollTop = 3 * ITEM_HEIGHT
  await settle()

  const offsetBefore = viewportOffsetOf("m3", viewport)

  // Prepend three older rows above the current scroll position.
  flushSync(() => {
    root!.render(
      <Thread items={[{ id: "o0" }, { id: "o1" }, { id: "o2" }, ...initial]} />
    )
  })
  await settle()

  const offsetAfter = viewportOffsetOf("m3", viewport)

  // The tracked message must not move within the viewport. With the old
  // content-relative restore it jumps up by the prepended height (~240px).
  expect(Math.abs(offsetAfter - offsetBefore)).toBeLessThanOrEqual(1)
})

test("opens at the bottom by default", async () => {
  await renderThread({ items: createItems(8) })

  expect(getDistanceToBottom(getViewport())).toBeLessThanOrEqual(1)
})

// A thread whose messages are fetched draws something else first -- a spinner,
// an empty state, a retry card. None of them is a message, so the opening
// position belongs to the thread that replaces them, not to the wait.
test("opens at the bottom when the first messages replace a placeholder", async () => {
  await renderThread({ items: [], placeholder: 40 })

  flushSync(() => {
    root!.render(<Thread items={createItems(8)} />)
  })
  await settle()

  expect(getDistanceToBottom(getViewport())).toBeLessThanOrEqual(1)
})

// The same swap, read the other way: the arriving thread is the thread opening,
// so nothing in it is a turn that just arrived, and none of it is anchored to.
test("does not anchor the first message when it replaces a placeholder", async () => {
  await renderThread({ items: [], placeholder: 40 })

  flushSync(() => {
    root!.render(
      <Thread
        items={createItems(8).map((item, index) => ({
          ...item,
          scrollAnchor: index % 2 === 0,
        }))}
      />
    )
  })
  await settle()

  expect(getScrollTop(getViewport())).toBeGreaterThan(0)
})

test("keeps auto-scroll pinned when the final message grows", async () => {
  const initial = createItems(6)

  await renderThread({ autoScroll: true, items: initial })

  const viewport = getViewport()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)

  flushSync(() => {
    root!.render(
      <Thread
        autoScroll
        items={initial.map((item, index) =>
          index === initial.length - 1 ? { ...item, height: 240 } : item
        )}
      />
    )
  })
  await settle()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)
})

test("releaseAutoScroll stops the final message growth from re-pinning to the end", async () => {
  const initial = createItems(6)

  await renderThread({
    autoScroll: true,
    items: initial,
    showReleaseButton: true,
  })

  const viewport = getViewport()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)

  const scrollTopBefore = getScrollTop(viewport)

  // Model a consumer that grows content in response to a user action (e.g.
  // expanding a collapsed section): hand scroll control back first, then grow
  // the final message in the same commit.
  document.querySelector<HTMLButtonElement>('[data-testid="release"]')!.click()

  flushSync(() => {
    root!.render(
      <Thread
        autoScroll
        showReleaseButton
        items={initial.map((item, index) =>
          index === initial.length - 1 ? { ...item, height: 240 } : item
        )}
      />
    )
  })
  await settle()

  // The growth stays below the fold instead of yanking the viewport to the end,
  // so the reader keeps looking at what they expanded.
  expect(getScrollTop(viewport)).toBe(scrollTopBefore)
  expect(getDistanceToBottom(viewport)).toBeGreaterThan(0)
})

test("keeps the end pinned when bulk appending anchored turns with autoScroll", async () => {
  const initial = createItems(6)

  await renderThread({ autoScroll: true, items: initial })

  const viewport = getViewport()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)

  flushSync(() => {
    root!.render(
      <Thread
        autoScroll
        items={[
          ...initial,
          { id: "new-user-1", scrollAnchor: true },
          { id: "new-assistant-1" },
          { id: "new-user-2", scrollAnchor: true },
          { id: "new-assistant-2" },
        ]}
      />
    )
  })
  await settle()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)
})

test("does not keep the end pinned when appending after the default bottom open", async () => {
  const initial = createItems(6)

  await renderThread({ items: initial })

  const viewport = getViewport()
  const scrollTop = getScrollTop(viewport)

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)

  flushSync(() => {
    root!.render(<Thread items={[...initial, { id: "new" }]} />)
  })
  await settle()

  expect(getScrollTop(viewport)).toBe(scrollTop)
  expect(getDistanceToBottom(viewport)).toBeGreaterThan(0)
})

test("holds an idle transcript at the end when a narrower viewport rewraps it", async () => {
  const items = createWrappingItems(8)

  await renderThread({ items, viewportWidth: 480 })

  const viewport = getViewport()
  const heightBefore = viewport.scrollHeight

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)

  // A pane opening beside the transcript: every row rewraps taller, which is
  // growth the reader did not ask for and cannot see, all of it above them.
  flushSync(() => {
    root!.render(<Thread items={items} viewportWidth={200} />)
  })
  await settle()

  expect(viewport.scrollHeight).toBeGreaterThan(heightBefore)
  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)
})

test("holds the end when the narrowing lands in the frame the scroller mounted in", async () => {
  const items = createWrappingItems(8)

  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  flushSync(() => {
    root!.render(<Thread items={items} viewportWidth={480} />)
  })

  // Deliberately no settle: a layout applied one commit after mount (a resizable
  // pane sizing itself, a container query resolving) reaches the observer before
  // its coalescing frame runs, so mount and narrowing arrive as a single resize
  // pass with no earlier one to have measured the old width.
  flushSync(() => {
    root!.render(<Thread items={items} viewportWidth={200} />)
  })
  await settle()

  expect(getDistanceToBottom(getViewport())).toBeLessThanOrEqual(1)
})

test("leaves a reader parked mid-transcript where they are when the viewport resizes", async () => {
  const items = createWrappingItems(8)

  await renderThread({ items, viewportWidth: 480 })

  const viewport = getViewport()

  viewport.dispatchEvent(
    new WheelEvent("wheel", { bubbles: true, deltaY: -ITEM_HEIGHT })
  )
  viewport.scrollTop = 0
  viewport.dispatchEvent(new Event("scroll", { bubbles: true }))
  await settle()

  expect(getDistanceToBottom(viewport)).toBeGreaterThan(0)

  flushSync(() => {
    root!.render(<Thread items={items} viewportWidth={200} />)
  })
  await settle()

  // Only a reader at the end is moved by a resize. Anywhere else the position
  // is theirs to keep, so the reflow leaves them where they were reading rather
  // than dropping them at the bottom of a transcript they were scrolled up in.
  // scrollTop itself is not asserted: the rewrap moves content above them, and
  // the browser's own anchoring is entitled to shift it to compensate.
  expect(getDistanceToBottom(viewport)).toBeGreaterThan(0)
})

test("scroll button moves the viewport to the end", async () => {
  await renderThread({
    defaultScrollPosition: "start",
    items: createItems(8),
    showButton: true,
  })

  const viewport = getViewport()

  expect(getScrollTop(viewport)).toBe(0)
  expect(getDistanceToBottom(viewport)).toBeGreaterThan(0)

  const button = document.querySelector("button") as HTMLButtonElement

  button.click()
  await settle()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)
})

test("keeps the scroll-to-end button inert at the bottom under an ancestor CSS zoom", async () => {
  // Under an ancestor CSS `zoom`, Chromium scales getBoundingClientRect while
  // leaving scrollTop/clientHeight in layout px. The old geometry mixed the two
  // and re-activated the button at the bottom; the fix reads only layout metrics.
  container = document.createElement("div")
  container.style.zoom = "1.5"
  document.body.appendChild(container)
  root = createRoot(container)
  flushSync(() => {
    root!.render(<Thread items={createItems(8)} showButton />)
  })
  await settle()

  const viewport = getViewport()

  // Guard the premise: the engine scales client rects under `zoom` (300 = 200 x
  // 1.5) but keeps scroll metrics in layout px. Fails loudly if that changes.
  expect(Math.round(viewport.getBoundingClientRect().height)).toBe(300)
  expect(viewport.clientHeight).toBe(VIEWPORT_HEIGHT)

  // Layout metrics agree the viewport is pinned to the bottom, so the button
  // must be inert. The old rect-based gap read ~100px here and kept it active.
  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)
  expect(
    document.querySelector<HTMLButtonElement>("button")?.dataset.active
  ).toBe("false")
})

// The reading line is a layout-px constant, so on screen it is that constant
// times the zoom. Placing the anchor means converting client rects into layout
// px before they meet scrollTop; getting that wrong scales the error by the
// distance below the fold, which is unbounded.
test.each([1, 1.5, 2])(
  "places an appended anchor on the reading line under CSS zoom %s",
  async (zoom) => {
    const history = createItems(8)

    await renderThread({ items: history, zoom })

    const viewport = getViewport()

    flushSync(() => {
      root!.render(
        <Thread items={[...history, { id: "turn", scrollAnchor: true }]} />
      )
    })
    await settle()

    expect(viewportOffsetOf("turn", viewport)).toBe(
      Math.round(DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK * zoom)
    )
  }
)

test("reserves the tail spacer in layout px under CSS zoom", async () => {
  const history = createItems(8)

  await renderThread({ items: history, zoom: 2 })

  const viewport = getViewport()

  flushSync(() => {
    root!.render(
      <Thread items={[...history, { id: "turn", scrollAnchor: true }]} />
    )
  })
  await settle()

  // The spacer exists so the turn can reach the reading line with nothing below
  // it: exactly the room between the end of the turn and the bottom of the
  // viewport, both in layout px. A rect-derived height would ask for twice it.
  const spacer = document.querySelector<HTMLElement>(
    "[data-message-scroller-spacer]"
  )!
  const reserved =
    VIEWPORT_HEIGHT - DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK - ITEM_HEIGHT

  expect(Math.round(Number.parseFloat(spacer.style.height))).toBe(reserved)
  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)
})

test("restores the last scroll anchor when the final turn overflows", async () => {
  await renderThread({
    defaultScrollPosition: "last-anchor",
    items: [
      { id: "m0" },
      { id: "m1" },
      { id: "last-user", scrollAnchor: true },
      { id: "last-assistant", height: 360 },
    ],
    scrollPreviousItemPeek: 0,
  })

  const viewport = getViewport()

  expect(viewportOffsetOf("last-user", viewport)).toBeLessThanOrEqual(1)
  expect(getDistanceToBottom(viewport)).toBeGreaterThan(0)
})

test("falls back to the end when the last anchored turn fits", async () => {
  await renderThread({
    defaultScrollPosition: "last-anchor",
    items: [
      ...createItems(5),
      { id: "last-user", scrollAnchor: true },
      { id: "last-assistant" },
    ],
    scrollPreviousItemPeek: 0,
  })

  expect(getDistanceToBottom(getViewport())).toBeLessThanOrEqual(1)
})

test("scrolls to a mounted message by id", async () => {
  await renderThread({
    defaultScrollPosition: "start",
    items: createItems(8),
    showJumpButton: true,
  })

  const viewport = getViewport()

  const button = document.querySelector("button") as HTMLButtonElement

  button.click()
  await settle()

  expect(viewportOffsetOf("m5", viewport)).toBeLessThanOrEqual(1)
})

test("preserves a scrolled-to turn across a prepend (command-path anchor)", async () => {
  // Characterization lock for the Phase-5 anchor-ref boundary: scrollToMessage
  // sets the preserve anchor OUTSIDE a content change (the command path), unlike
  // every other prepend test which scrolls directly. Jumping then prepending
  // must keep the jumped-to turn fixed, not lose its anchor.
  const initial = createItems(12)

  await renderThread({
    defaultScrollPosition: "start",
    items: initial,
    showJumpButton: true,
  })

  const viewport = getViewport()

  ;(document.querySelector("button") as HTMLButtonElement).click()
  await settle()

  const offsetBefore = viewportOffsetOf("m5", viewport)
  expect(offsetBefore).toBeLessThanOrEqual(1)

  flushSync(() => {
    root!.render(
      <Thread
        defaultScrollPosition="start"
        items={[{ id: "o0" }, { id: "o1" }, { id: "o2" }, ...initial]}
        showJumpButton
      />
    )
  })
  await settle()

  expect(
    Math.abs(viewportOffsetOf("m5", viewport) - offsetBefore)
  ).toBeLessThanOrEqual(1)
})

test("user scroll intent cancels follow-bottom", async () => {
  const initial = createItems(8)

  await renderThread({ autoScroll: true, items: initial })

  const viewport = getViewport()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)

  viewport.dispatchEvent(
    new WheelEvent("wheel", { bubbles: true, deltaY: -ITEM_HEIGHT })
  )
  viewport.scrollTop = 0
  viewport.dispatchEvent(new Event("scroll", { bubbles: true }))
  await settle()

  expect(getScrollTop(viewport)).toBe(0)

  flushSync(() => {
    root!.render(<Thread autoScroll items={[...initial, { id: "new" }]} />)
  })
  await settle()

  expect(getScrollTop(viewport)).toBe(0)
  expect(getDistanceToBottom(viewport)).toBeGreaterThan(0)
})

// The room a held turn reserves is spent by whoever gets there first: the reply
// growing into it, or the reader scrolling up through it. These two cover the
// reader's half, which is the half that used to be taken from them by force.
const HELD_TURN_ROOM =
  VIEWPORT_HEIGHT - DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK - ITEM_HEIGHT

async function holdATurn() {
  const history = createItems(8)
  const sent = [...history, { id: "turn", scrollAnchor: true }]

  await renderThread({ autoScroll: true, items: history })

  flushSync(() => {
    root!.render(<Thread autoScroll items={sent} />)
  })
  await settle()

  expect(viewportOffsetOf("turn", getViewport())).toBe(
    DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK
  )
  expect(getTailSpacer()).toBe(HELD_TURN_ROOM)

  return sent
}

test("gives back a held turn's room as the reader scrolls up through it", async () => {
  const sent = await holdATurn()
  const viewport = getViewport()

  // A nudge, well short of the room. It costs exactly what was scrolled off,
  // which is invisible: the room only shrinks to where the viewport already is.
  scrollByGesture(viewport, -20)
  await settle()

  expect(viewportOffsetOf("turn", viewport)).toBe(
    DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK + 20
  )
  expect(getTailSpacer()).toBe(HELD_TURN_ROOM - 20)

  // What the step the agent produces next must not do is read the room still
  // below the content as "the reader is at the end" and pin them to the bottom
  // over it, taking their 20px with it.
  flushSync(() => {
    root!.render(<Thread autoScroll items={[...sent, { id: "reply" }]} />)
  })
  await settle()

  expect(viewportOffsetOf("turn", viewport)).toBe(
    DEFAULT_SCROLL_PREVIOUS_ITEM_PEEK + 20
  )
})

test("sticks to the bottom once the reader has scrolled the room away", async () => {
  const sent = await holdATurn()
  const viewport = getViewport()

  // Reading further back than the room can pay for spends all of it, and with
  // nothing holding a position open below the content the transcript is an
  // ordinary one again: the end is the end.
  scrollByGesture(viewport, -(HELD_TURN_ROOM + ITEM_HEIGHT))
  await settle()

  expect(getTailSpacer()).toBe(0)
  expect(getDistanceToBottom(viewport)).toBeGreaterThan(0)

  // Which means coming back down to the end hands following back, rather than
  // stranding the reader below a transcript that will not follow.
  scrollByGesture(viewport, VIEWPORT_HEIGHT * 2)
  await settle()

  flushSync(() => {
    root!.render(<Thread autoScroll items={[...sent, { id: "reply" }]} />)
  })
  await settle()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)
})

test("tracks the current anchor as it scrolls above the viewport", async () => {
  // Every tenth row is a turn-start anchor: m0, m10, m20.
  const items = Array.from({ length: 30 }, (_, index) => ({
    id: `m${index}`,
    scrollAnchor: index % 10 === 0,
  }))

  await renderThread({
    defaultScrollPosition: "start",
    items,
    showVisibility: true,
  })

  const viewport = getViewport()

  // Opened at the top → the first anchor is current. The subscribed probe
  // settles on a post-mount rAF, so the value is only correct after the settle()
  // that renderThread awaits.
  expect(getCurrentAnchor()).toBe("m0")

  // Scroll until m10 is fully above the viewport. It must stay current even
  // though it is no longer visible — the behavior the old activeMessageId (and
  // jsdom) could not express.
  viewport.scrollTop = 900
  await settle()

  expect(getCurrentAnchor()).toBe("m10")
  expect(getVisibleIds()).not.toContain("m10")

  // Scrolling past the next anchor advances the cursor.
  viewport.scrollTop = 1700
  await settle()

  expect(getCurrentAnchor()).toBe("m20")
})

test("keeps the anchor at the reading line current over lower visible anchors", async () => {
  // Every row is a turn-start anchor, so several are on screen at once — the
  // scrollToMessage case. Jumping to a turn must keep IT current even though
  // newer anchors sit below it and are still visible (the regression where the
  // lowest visible anchor wrongly stole "current").
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `m${index}`,
    scrollAnchor: true,
  }))

  await renderThread({
    defaultScrollPosition: "start",
    items,
    showVisibility: true,
  })

  const viewport = getViewport()

  // Bring m5 up to the reading line; m6 and m7 sit below it, also visible.
  viewport.scrollTop = 5 * ITEM_HEIGHT
  await settle()

  expect(getCurrentAnchor()).toBe("m5")
  // m6 is on screen but below the line — it must not steal current.
  expect(getVisibleIds()).toContain("m6")
})

test("visibility populates under StrictMode (frame ref + lifecycle survive remount)", async () => {
  const ids = Array.from({ length: 8 }, (_, index) => `m${index}`)

  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  // StrictMode double-invokes mount → unmount → remount on the same refs, which
  // is what wedges the rAF scheduler and tears the subscription in Next dev.
  flushSync(() => {
    root!.render(
      <React.StrictMode>
        <MessageScrollerProvider defaultScrollPosition="start">
          <MessageScroller>
            <MessageScrollerViewport
              aria-label="viewport"
              style={{ height: VIEWPORT_HEIGHT, overflowY: "auto" }}
            >
              <MessageScrollerContent
                style={{ display: "flex", flexDirection: "column" }}
              >
                {ids.map((id, index) => (
                  <MemoMessageItem key={id} id={id} anchor={index % 2 === 0} />
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <VisibilityProbe />
          </MessageScroller>
        </MessageScrollerProvider>
      </React.StrictMode>
    )
  })
  await settle()

  // Force a recompute after StrictMode's mount churn.
  getViewport().scrollTop = 0
  getViewport().dispatchEvent(new Event("scroll", { bubbles: true }))
  await settle()

  expect(getCurrentAnchor()).toBe("m0")
  expect(getVisibleIds().length).toBeGreaterThan(0)
})

test("tracks visibility through memoized item components", async () => {
  const ids = Array.from({ length: 8 }, (_, index) => `m${index}`)

  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  flushSync(() => {
    root!.render(
      <MessageScrollerProvider defaultScrollPosition="start">
        <MessageScroller>
          <MessageScrollerViewport
            aria-label="viewport"
            style={{ height: VIEWPORT_HEIGHT, overflowY: "auto" }}
          >
            <MessageScrollerContent
              style={{ display: "flex", flexDirection: "column" }}
            >
              {ids.map((id, index) => (
                <MemoMessageItem key={id} id={id} anchor={index % 2 === 0} />
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <VisibilityProbe />
        </MessageScroller>
      </MessageScrollerProvider>
    )
  })
  await settle()

  // currentAnchorId scans the DOM (memo-independent). visibleMessageIds rides
  // registration + the real IntersectionObserver — the path memo could break.
  expect(getCurrentAnchor()).toBe("m0")
  expect(getVisibleIds().length).toBeGreaterThan(0)
  expect(getVisibleIds()).toContain("m0")
})

test("an anchored turn holds at the top when content below it collapses", async () => {
  const peek = 32
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)

  const base = [
    { id: "m0", height: 300 },
    { id: "m1", height: 300 },
    { id: "m2", height: 300 },
  ]

  flushSync(() => {
    root!.render(<Thread items={base} scrollPreviousItemPeek={peek} />)
  })
  await settle()

  // A new turn (anchor) arrives with a transient marker below it — like the
  // demo's "Thinking..." placeholder — so it has content below to reach the top.
  flushSync(() => {
    root!.render(
      <Thread
        scrollPreviousItemPeek={peek}
        items={[
          ...base,
          { id: "turn", height: 80, scrollAnchor: true },
          { id: "marker", height: 100 },
        ]}
      />
    )
  })
  await settle()

  expect(viewportOffsetOf("turn", getViewport())).toBeLessThanOrEqual(peek + 4)

  // The marker is replaced by an empty reply that will stream in: the content
  // below the turn collapses. The turn must stay pinned at the top, not drop as
  // the browser clamps scrollTop to the shorter content.
  flushSync(() => {
    root!.render(
      <Thread
        scrollPreviousItemPeek={peek}
        items={[
          ...base,
          { id: "turn", height: 80, scrollAnchor: true },
          { id: "reply", height: 0 },
        ]}
      />
    )
  })
  await settle()
  await settle()

  expect(viewportOffsetOf("turn", getViewport())).toBeLessThanOrEqual(peek + 4)
})

test("auto-scroll and content updates survive a StrictMode remount", async () => {
  // StrictMode mounts, unmounts, then remounts on the same refs. The existing
  // StrictMode test covers the visibility frame; this one covers the rest of the
  // machinery — the state + scroll frame refs must reset on the remount so
  // follow-bottom keeps working, not just on first mount.
  const items = createItems(6)

  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)

  flushSync(() => {
    root!.render(
      <React.StrictMode>
        <Thread autoScroll items={items} showVisibility />
      </React.StrictMode>
    )
  })
  await settle()

  const viewport = getViewport()
  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)

  // A new message after the remount still drives the content-change + scroll path.
  flushSync(() => {
    root!.render(
      <React.StrictMode>
        <Thread autoScroll items={[...items, { id: "new" }]} showVisibility />
      </React.StrictMode>
    )
  })
  await settle()

  expect(getDistanceToBottom(viewport)).toBeLessThanOrEqual(1)
  expect(getVisibleIds().length).toBeGreaterThan(0)
})
