from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    def handle_console(msg):
        print(f"CONSOLE: {msg.text}")

    page.on('console', handle_console)

    page.goto("http://localhost:8000")

    # Wait for the main menu to be visible
    main_menu = page.locator("#main-menu")
    main_menu.wait_for(state="visible", timeout=60000)

    # Click the "New Game" button
    new_game_btn = page.locator("#new-game-btn")
    new_game_btn.click()

    # Wait for the loading screen to disappear
    loading_screen = page.locator("#loading-screen")
    loading_screen.wait_for(state="hidden", timeout=60000)

    # Wait for a moment to ensure the world is rendered
    page.wait_for_timeout(5000)

    page.screenshot(path="jules-scratch/verification/verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
