"""Run a visible QA pass for the current ten-tool Ribband workspace.

This script does not start a recording or upload media. It is a convenience pass
for the deployed page after James explicitly deploys the current branch.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
import sys

from playwright.async_api import Page, async_playwright, expect


DEFAULT_URL = "https://agentic-webmcp.somnora.workers.dev/"


async def capture(page: Page, name: str) -> None:
    output = os.environ.get("AGENTIC_DEMO_QA_DIR")
    if not output:
        return
    destination = Path(output).expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(destination / f"{name}.png"), full_page=False)


async def run_qa(base_url: str) -> None:
    async with async_playwright() as playwright:
        chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        launch_options: dict[str, object] = {
            "headless": False,
            "args": ["--enable-blink-features=WebMCPTesting,WebMCP"],
        }
        if chrome.exists():
            launch_options["executable_path"] = str(chrome)
        browser = await playwright.chromium.launch(**launch_options)
        context = await browser.new_context(viewport={"width": 2560, "height": 1440}, color_scheme="light")
        page = await context.new_page()
        console_errors: list[str] = []
        page_errors: list[str] = []
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        await page.goto(base_url, wait_until="load")
        await expect(page.locator("#origin-select")).to_have_value("catalog-lab", timeout=15000)
        await expect(page.locator("#origin-meta")).to_contain_text("agentic-webmcp-origin.somnora.workers.dev")
        await expect(page.locator("#origin-meta")).to_contain_text("controlled demo")
        await expect(page.locator("#origin-health")).not_to_contain_text("Checking")
        await expect(page.locator("#origin-health")).to_contain_text("page live")
        await capture(page, "01-origin")

        recommend = page.locator("#recommend-input")
        await recommend.fill("electric guitar")
        await page.locator("#recommend-budget").fill("900")
        await page.locator("#recommend-form button[type='submit']").click()
        await expect(page.locator("#product-grid")).to_contain_text("Sunburst S-Style Electric", timeout=15000)
        await expect(page.locator("#activity-list")).to_contain_text("find_best_options")
        await capture(page, "02-recommend")

        interpolate = page.locator("#interpolate-path")
        await interpolate.fill("/products/sunburst-s-style-electric")
        await page.locator("#interpolate-form button[type='submit']").click()
        await expect(page.locator("#interpolate-canonical")).to_have_text(
            "https://agentic-webmcp-origin.somnora.workers.dev/products/sunburst-s-style-electric",
            timeout=15000,
        )
        await expect(page.locator("#activity-list")).to_contain_text("interpolate_page")
        await expect(page.locator("#interpolate-view")).to_contain_text("two agent-ready projections")
        await expect(page.locator("#interpolate-provenance")).to_contain_text("Verified across product JSON and page")
        await expect(page.locator("#interpolate-offer-status")).to_have_text("EVIDENCE VERIFIED | HANDOFF READY")
        await capture(page, "03-interpolate")

        propose = page.locator("#product-grid .product-card").get_by_role(
            "button", name="Prepare review", exact=True
        ).first
        await propose.click()
        await expect(page.locator("#confirm-panel")).to_be_visible(timeout=15000)
        await expect(page.locator("#confirm-panel")).to_be_visible()
        await expect(page.locator("#cart-empty")).to_be_visible()
        await capture(page, "04-proposal")

        await page.locator("#confirm-cart").click()
        await expect(page.locator("#cart-list")).to_contain_text("approved for merchant handoff", timeout=15000)
        await expect(page.locator("#download-dossier")).to_be_enabled()
        await capture(page, "05-confirmed")

        status = (await page.locator("#webmcp-status").inner_text()).strip()
        if "10 WebMCP tools registered" not in status:
            print(f"WebMCP status: {status}")
            print("The manual flow passed, but the recording browser did not expose all ten tools.")

        unexpected = [message for message in console_errors if "favicon" not in message.lower()]
        if unexpected or page_errors:
            raise RuntimeError("Browser errors during QA: " + "; ".join(unexpected + page_errors))

        print("Visible QA pass completed. No recording or upload was performed.")
        await browser.close()


if __name__ == "__main__":
    url = DEFAULT_URL
    for argument in sys.argv[1:]:
        if argument.startswith(("http://", "https://")):
            url = argument.rstrip("/") + "/"
    asyncio.run(run_qa(url))
