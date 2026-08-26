"""Drive a deterministic two-minute Agentic WebMCP recording.

The script launches the deployed application in Chrome, injects a visible
cursor/spotlight/caption guide, and exercises the same functions used by the
registered WebMCP tools. QuickTime or another screen recorder captures the
visible browser; this script does not request screen-recording permission.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
import sys
import time

from playwright.async_api import Page, async_playwright, expect


DEFAULT_URL = "https://agentic-webmcp.somnora.workers.dev/"
BRIEF_GOAL = "Choose comfortable everyday apparel with clear availability."


GUIDE_CSS = r"""
#agentic-demo-guide { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
#agentic-demo-spotlight { position: fixed; z-index: 1; left: -200px; top: -200px; width: 20px; height: 20px; border: 2px solid #ff9d42; border-radius: 14px; box-shadow: 0 0 0 9999px rgba(0,11,12,.42), 0 0 30px rgba(255,126,38,.72); transition: left .58s cubic-bezier(.16,1,.3,1), top .58s cubic-bezier(.16,1,.3,1), width .58s cubic-bezier(.16,1,.3,1), height .58s cubic-bezier(.16,1,.3,1), border-color .18s, opacity .22s; opacity: 0; }
#agentic-demo-cursor { position: fixed; z-index: 3; left: 0; top: 0; width: 26px; height: 32px; transform: translate3d(-80px,-80px,0); transition: transform .68s cubic-bezier(.16,1,.3,1), opacity .18s; filter: drop-shadow(0 2px 3px rgba(0,0,0,.92)) drop-shadow(0 0 4px rgba(255,126,38,.68)); opacity: 0; will-change: transform; }
#agentic-demo-cursor svg { width: 26px; height: 32px; display: block; overflow: visible; }
#agentic-demo-panel { position: fixed; z-index: 4; left: 50%; bottom: 22px; transform: translateX(-50%) translateY(10px); width: min(720px, calc(100vw - 48px)); color: #f8fafc; background: linear-gradient(135deg, rgba(2,20,20,.98), rgba(3,35,34,.96)); border: 1px solid rgba(255,157,66,.62); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.66), inset 0 1px rgba(255,255,255,.06); padding: 15px 18px 14px; opacity: 0; transition: opacity .22s, transform .32s cubic-bezier(.16,1,.3,1); }
#agentic-demo-panel.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
#agentic-demo-kicker { display: flex; align-items: center; gap: 9px; color: #ffb469; font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
#agentic-demo-kicker::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #31d6a4; box-shadow: 0 0 12px rgba(49,214,164,.85); }
#agentic-demo-title { margin-top: 5px; font-size: 19px; line-height: 1.25; font-weight: 780; letter-spacing: -.015em; }
#agentic-demo-detail { margin-top: 3px; color: #cbd5e1; font-size: 13px; line-height: 1.45; }
#agentic-demo-result { position: fixed; z-index: 5; right: 24px; top: 24px; max-width: 430px; color: #d1fae5; background: rgba(3,49,40,.98); border: 1px solid rgba(52,211,153,.72); border-radius: 12px; box-shadow: 0 14px 38px rgba(0,0,0,.58); padding: 12px 15px; font-size: 13px; font-weight: 720; opacity: 0; transform: translateY(-12px); transition: opacity .22s, transform .3s cubic-bezier(.16,1,.3,1); }
#agentic-demo-result.visible { opacity: 1; transform: translateY(0); }
.agentic-demo-pulse { position: fixed; z-index: 6; width: 18px; height: 18px; margin: -9px 0 0 -9px; border: 3px solid #ff9d42; border-radius: 50%; animation: agentic-demo-pulse .68s ease-out forwards; }
@keyframes agentic-demo-pulse { from { opacity: 1; transform: scale(.45); } to { opacity: 0; transform: scale(3.25); } }
"""


GUIDE_SCRIPT = r"""
() => {
  if (window.agenticDemoGuide) return;
  const root = document.createElement('div');
  root.id = 'agentic-demo-guide';
  root.innerHTML = `
    <div id="agentic-demo-spotlight"></div>
    <div id="agentic-demo-cursor" aria-hidden="true">
      <svg viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 1.5L23.5 20.2H14.2L10.4 30.2L5.6 28.3L9.3 18.5H2V1.5Z" fill="#FFFFFF" stroke="#111827" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M2 1.5L23.5 20.2H14.2L10.4 30.2L5.6 28.3L9.3 18.5H2V1.5Z" stroke="#FF7A1A" stroke-width="1.15" stroke-linejoin="round"/>
      </svg>
    </div>
    <div id="agentic-demo-panel">
      <div id="agentic-demo-kicker"></div>
      <div id="agentic-demo-title"></div>
      <div id="agentic-demo-detail"></div>
    </div>
    <div id="agentic-demo-result"></div>`;
  document.body.appendChild(root);
  const cursor = root.querySelector('#agentic-demo-cursor');
  const spotlight = root.querySelector('#agentic-demo-spotlight');
  const panel = root.querySelector('#agentic-demo-panel');
  const result = root.querySelector('#agentic-demo-result');
  let resultTimer;
  let cursorX = -80;
  let cursorY = -80;
  window.agenticDemoGuide = {
    ready() {
      root.querySelector('#agentic-demo-kicker').textContent = 'Guided capture ready';
      root.querySelector('#agentic-demo-title').textContent = 'Start QuickTime, then press Enter in the terminal';
      root.querySelector('#agentic-demo-detail').textContent = 'The cursor, click rings, spotlights, captions, and result confirmations will run automatically.';
      panel.classList.add('visible');
    },
    scene(step, title, detail) {
      clearTimeout(resultTimer);
      result.classList.remove('visible');
      root.querySelector('#agentic-demo-kicker').textContent = `Scene ${step} of 6`;
      root.querySelector('#agentic-demo-title').textContent = title;
      root.querySelector('#agentic-demo-detail').textContent = detail;
      panel.classList.add('visible');
    },
    focus(box, padding = 10) {
      if (!box) return;
      const left = Math.max(8, box.x - padding);
      const top = Math.max(8, box.y - padding);
      const width = Math.min(innerWidth - left - 8, box.width + padding * 2);
      const height = Math.min(innerHeight - top - 8, box.height + padding * 2);
      spotlight.style.left = `${left}px`;
      spotlight.style.top = `${top}px`;
      spotlight.style.width = `${width}px`;
      spotlight.style.height = `${height}px`;
      // A bordered spotlight can visibly cut through a pointer on compact
      // controls. Keep the dimming/glow, but hide that border for short rows.
      spotlight.style.borderColor = height < 72 ? 'transparent' : '#ff9d42';
      spotlight.style.opacity = '1';
      cursorX = Math.min(innerWidth - 28, Math.max(14, box.x + box.width * .72));
      cursorY = Math.min(innerHeight - 34, Math.max(14, box.y + box.height * .5));
      cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
      cursor.style.opacity = '1';
    },
    pulse() {
      const pulse = document.createElement('div');
      pulse.className = 'agentic-demo-pulse';
      pulse.style.left = `${cursorX + 2}px`;
      pulse.style.top = `${cursorY + 2}px`;
      root.appendChild(pulse);
      setTimeout(() => pulse.remove(), 760);
    },
    result(message) {
      clearTimeout(resultTimer);
      result.textContent = `CONFIRMED  ${message}`;
      result.classList.add('visible');
      resultTimer = setTimeout(() => result.classList.remove('visible'), 6200);
    },
    clearFocus() {
      spotlight.style.opacity = '0';
      cursor.style.opacity = '0';
    }
  };
}
"""


async def install_guide(page: Page) -> None:
    # The production page intentionally rejects inline style tags through CSP.
    # A constructed stylesheet keeps that security policy intact while allowing
    # the local recording harness to render its non-interactive guide layer.
    await page.evaluate(
        """css => {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(css);
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }""",
        GUIDE_CSS,
    )
    await page.evaluate(GUIDE_SCRIPT)


async def guide_scene(
    page: Page, step: int, title: str, detail: str, target=None, *, padding: int = 12
) -> None:
    await page.evaluate(
        "([step, title, detail]) => window.agenticDemoGuide.scene(step, title, detail)",
        [step, title, detail],
    )
    if target is not None:
        target = target.first
        await target.evaluate("element => element.scrollIntoView({behavior:'smooth', block:'center'})")
        await page.wait_for_timeout(520)
        box = await target.bounding_box()
        await page.evaluate(
            "([box, padding]) => window.agenticDemoGuide.focus(box, padding)",
            [box, padding],
        )
        await page.wait_for_timeout(760)


async def guided_click(page: Page, target, *, settle_ms: int = 420) -> None:
    target = target.first
    await target.evaluate("element => element.scrollIntoView({behavior:'smooth', block:'center'})")
    await page.wait_for_timeout(480)
    box = await target.bounding_box()
    await page.evaluate("box => window.agenticDemoGuide.focus(box, 10)", box)
    await page.wait_for_timeout(settle_ms)
    await page.evaluate("window.agenticDemoGuide.pulse()")
    await page.wait_for_timeout(180)
    await target.click()


async def guide_result(page: Page, message: str, target=None) -> None:
    if target is not None:
        target = target.first
        await target.evaluate("element => element.scrollIntoView({behavior:'smooth', block:'center'})")
        await page.wait_for_timeout(520)
        box = await target.bounding_box()
        await page.evaluate("box => window.agenticDemoGuide.focus(box, 12)", box)
        await page.wait_for_timeout(650)
    await page.evaluate("message => window.agenticDemoGuide.result(message)", message)
    await page.wait_for_timeout(300)


async def wait_until(started_at: float, target_seconds: float, scale: float) -> None:
    remaining = target_seconds * scale - (time.monotonic() - started_at)
    if remaining > 0:
        await asyncio.sleep(remaining)


async def qa_capture(page: Page, name: str) -> None:
    output = os.environ.get("AGENTIC_DEMO_QA_DIR")
    if not output:
        return
    destination = Path(output).expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(destination / f"{name}.png"))


async def run_demo(base_url: str, fast_mode: bool = False) -> None:
    scale = 0.09 if fast_mode else 1.0
    print("\n" + "=" * 72)
    print("AGENTIC WEBMCP AUTOMATED RECORDING DEMO")
    print(f"Target URL: {base_url}")
    print("Target runtime: 1 minute 55 seconds")
    print("=" * 72 + "\n")

    async with async_playwright() as playwright:
        chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        launch_options: dict[str, object] = {
            "headless": False,
            "args": [
                "--start-maximized",
                "--window-size=1600,1000",
                "--enable-blink-features=WebMCPTesting,WebMCP",
            ],
        }
        if chrome.exists():
            launch_options["executable_path"] = str(chrome)
        browser = await playwright.chromium.launch(**launch_options)
        context = await browser.new_context(
            viewport={"width": 1500, "height": 950}, color_scheme="dark"
        )
        page = await context.new_page()
        console_errors: list[str] = []
        page_errors: list[str] = []
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        await page.goto(base_url, wait_until="load")
        await expect(page.locator("#product-grid .product-card")).to_have_count(6, timeout=15000)
        await install_guide(page)
        await page.evaluate("window.agenticDemoGuide.ready()")
        await guide_scene(
            page,
            1,
            "Four explicit tools, one shared workspace",
            "Agentic exposes focused, read-only catalog capabilities while every result remains visible to the human.",
            page.locator(".status-cluster"),
        )

        status = (await page.locator("#webmcp-status").inner_text()).strip()
        if "4 WebMCP tools registered" not in status:
            await page.evaluate(
                "message => window.agenticDemoGuide.result(message)",
                "Recorder Chrome did not expose WebMCP. Enable chrome://flags/#enable-webmcp-testing before the final take.",
            )
            if not fast_mode:
                print("WARNING: recording browser reports:", status)
                print("Enable chrome://flags/#enable-webmcp-testing in Chrome, relaunch, and rerun.")
                await asyncio.sleep(6)
                await browser.close()
                raise RuntimeError("WebMCP is unavailable in the recording browser")

        if not fast_mode:
            print("START QUICKTIME SCREEN RECORDING, THEN PRESS ENTER")
            input(">>> Press [ENTER] when recording is running... <<<")
        started_at = time.monotonic()

        print("[0:00-0:18] DISCOVERY")
        await page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
        await guide_scene(
            page,
            1,
            "Discover the page's commerce contract",
            "The browser registers search, product inspection, comparison, and catalog-brief tools with narrow schemas.",
            page.locator("[aria-label='Available tools']"),
            padding=10,
        )
        await qa_capture(page, "01-tool-discovery")
        await wait_until(started_at, 18, scale)

        print("[0:18-0:38] SEARCH")
        search = page.locator("#search-input")
        await guide_scene(
            page,
            2,
            "Search through an explicit catalog function",
            "This deterministic human preview calls the same bounded search function exposed to agents as search_products.",
            search,
        )
        await search.fill("hoodie")
        await guided_click(page, page.locator("#search-form button[type='submit']"))
        await expect(page.locator("#catalog-message")).to_contain_text("product result", timeout=12000)
        await guide_result(
            page,
            "Live Shopify Mock Shop results updated the catalog and activity rail.",
            page.locator("#product-grid"),
        )
        await qa_capture(page, "02-search")
        await wait_until(started_at, 38, scale)

        print("[0:38-0:56] PRODUCT INSPECTION")
        hoodie = page.locator("#product-grid .product-card").filter(has_text="Hoodie").first
        inspect = hoodie.get_by_role("button", name="Inspect")
        await guide_scene(
            page,
            3,
            "Inspect current variants and availability",
            "The preview calls the same get_product function: one stable handle returns bounded facts and sampled variants.",
            inspect,
        )
        await guided_click(page, inspect)
        await expect(page.locator("#activity-list")).to_contain_text("get_product", timeout=12000)
        await guide_result(page, "Product detail returned without reviews, ratings, or invented claims.", page.locator("#result-panel"))
        await qa_capture(page, "03-product-detail")
        await wait_until(started_at, 56, scale)

        print("[0:56-1:18] COMPARISON")
        await guided_click(page, page.get_by_role("button", name="Show catalog"))
        await expect(page.locator("#product-grid .product-card")).to_have_count(6, timeout=12000)
        slides = page.get_by_label("Select Slides for comparison")
        sweats = page.get_by_label("Select Sweatpants for comparison")
        await guide_scene(
            page,
            4,
            "Compare two products in shared state",
            "The same compare_products function accepts two to four unique handles and renders grounded facts visibly.",
            slides,
        )
        await guided_click(page, slides)
        await guided_click(page, sweats)
        await guided_click(page, page.locator("#compare-button"))
        await expect(page.locator("#activity-list")).to_contain_text("compare_products", timeout=12000)
        await guide_result(page, "Slides and Sweatpants rendered side by side from live catalog data.", page.locator("#product-grid"))
        await qa_capture(page, "04-comparison")
        await wait_until(started_at, 78, scale)

        print("[1:18-1:38] GROUNDED BRIEF")
        goal = page.locator("#brief-goal")
        await guide_scene(
            page,
            5,
            "Create a brief with visible source products",
            "The same create_catalog_brief function produces deterministic Markdown grounded only in selected facts.",
            goal,
        )
        await goal.fill(BRIEF_GOAL)
        await guided_click(page, page.locator("#brief-button"))
        await expect(page.locator("#activity-list")).to_contain_text("create_catalog_brief", timeout=12000)
        await guide_result(page, "Grounded brief created; source products remain visible.", page.locator("#result-panel"))
        await qa_capture(page, "05-brief")
        await wait_until(started_at, 98, scale)

        print("[1:38-1:55] TRUST BOUNDARY")
        trust = page.locator(".trust-note")
        await guide_scene(
            page,
            6,
            "Explicit for agents. Transparent for humans.",
            "All tools are read-only, externally sourced text is untrusted, and no checkout, account, payment, or mutation capability exists.",
            trust,
        )
        await page.evaluate("window.agenticDemoGuide.clearFocus()")
        await wait_until(started_at, 115, scale)

        unexpected = [message for message in console_errors if "favicon" not in message.lower()]
        if unexpected or page_errors:
            raise RuntimeError("Browser errors during demo: " + "; ".join(unexpected + page_errors))
        print("\nTAKE COMPLETE — stop QuickTime recording\n")
        await asyncio.sleep(2 if not fast_mode else 0.3)
        await browser.close()


if __name__ == "__main__":
    url = DEFAULT_URL
    fast = "--fast" in sys.argv
    for argument in sys.argv[1:]:
        if argument.startswith(("http://", "https://")):
            url = argument.rstrip("/") + "/"
    asyncio.run(run_demo(url, fast_mode=fast))
