"""Acceptance journeys 1–8 from the frontend redesign brief.

Usage: pnpm dev, then  python3 scripts/e2e_journeys.py [http://localhost:5173]
Needs: pip install playwright (set CHROME_PATH to use an installed Chrome).
Each journey starts from a fresh install (storage cleared) unless it says otherwise.
"""
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
SHOTS = os.environ.get("NEEMA_E2E_SHOTS", "/tmp")
DB = "neema-mama-passport"

INIT = """
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]');
  if (a) { e.preventDefault(); window.__links = (window.__links||[]).concat(a.getAttribute('href')); }
}, true);
"""

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

def read_store(page, store):
    return page.evaluate("""(s) => new Promise((res) => {
      const r = indexedDB.open('%s');
      r.onsuccess = () => { const g = r.result.transaction(s).objectStore(s).getAll(); g.onsuccess = () => res(g.result); };
    })""" % DB, store)

def profile(page):
    rows = read_store(page, "profile")
    return json.loads(rows[0]["payload"]) if rows else None

def fresh(page, lang="en"):
    page.goto(f"{BASE}/start")
    page.evaluate(f"localStorage.clear(); sessionStorage.clear(); localStorage.setItem('neema.lang.v1','{lang}')")
    page.evaluate("new Promise(r=>{const q=indexedDB.deleteDatabase('%s');q.onsuccess=q.onerror=q.onblocked=()=>r(1)})" % DB)
    page.goto(f"{BASE}/start")
    page.wait_for_url("**/orient")

def no_overflow(page):
    return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

def register(page, role="self", phone_kind=None, note=None, chp=True, weeks="24", days="3"):
    page.locator(".btn-ghost").first.click()  # skip story
    page.wait_for_url("**/register")
    nxt = page.locator(".reg-actions .btn-primary")
    if role != "self":
        page.locator(".reg-choice").nth({"chw": 1, "nurse": 2}[role]).click()
        page.fill("#reg-registrar", "Grace Achieng")
        page.fill("#reg-staffid", "CHW-0042" if role == "chw" else "NCK-1188")
    nxt.click()
    nxt.click()  # empty → field errors
    check(f"{role}: full name is required with a field message", page.locator("#reg-full-error").count() == 1 and page.locator("#reg-full").get_attribute("aria-invalid") == "true")
    page.fill("#reg-display", "Wanjiru")
    page.fill("#reg-full", "Wanjiru Kamau")
    page.fill("#reg-dob", "1998-04-12")
    page.fill("#reg-phone", "0712 345 678")
    page.fill("#reg-loc", "Kawangware")
    if phone_kind:
        page.get_by_role("radio", name={"basic": "Basic phone", "none": "No phone", "smartphone": "Smartphone"}[phone_kind]).click()
        page.locator(".reg-agree input").check()
    nxt.click()
    nxt.click()  # empty pregnancy step → errors
    check(f"{role}: gestational age is required", page.locator("#reg-gaw-error").count() == 1)
    page.fill("#reg-gaw", weeks)
    page.select_option("#reg-gad", days)
    page.get_by_role("radio", name="No", exact=True).click()
    page.fill("#reg-prev", "1")
    page.get_by_role("button", name="Caesarean (operation) birth").click()
    nxt.click()
    page.get_by_role("button", name="High blood pressure", exact=True).click()
    # Allergies: pick, then try "none" (clears), then pick again + add "other"
    page.get_by_role("button", name="Latex (rubber gloves)").click()
    page.get_by_role("button", name="No known allergies").click()
    contradiction_ok = page.get_by_role("button", name="Latex (rubber gloves)").is_disabled() and \
        page.get_by_role("button", name="Latex (rubber gloves)").get_attribute("aria-pressed") == "false"
    page.get_by_role("button", name="No known allergies").click()
    page.get_by_role("button", name="Penicillin (amoxicillin)").click()
    page.fill("#reg-alg-other", "Mango")
    page.get_by_role("button", name="Add", exact=True).click()
    page.fill("#reg-alg-other", "Pollen")
    page.keyboard.press("Enter")
    page.get_by_role("button", name="Remove Pollen").click()
    check(f"{role}: 'No known allergies' clears and blocks other picks", contradiction_ok)
    page.fill("#reg-meds", "iron, folic acid")
    page.fill("#reg-notes", "I get headaches in the evening.")
    nxt.click()
    if chp:
        page.fill("#reg-chpn", "Mama Otieno")
        page.fill("#reg-chpp", "0722 111 234")
    page.fill("#reg-famn", "Juma")
    page.fill("#reg-famp", "0733 987 654")
    nxt.click()
    if role == "nurse":
        page.fill("#reg-clin", note or "BP 128/82 at booking. Hb 11.2. Next ANC in 4 weeks.")
        nxt.click()
    nxt.click()  # try without accepting the terms
    check(f"{role}: Terms are not pre-ticked and are required", not page.locator("#reg-terms").is_checked() and page.locator("#reg-terms-error").count() == 1)
    page.locator("#reg-terms").check()
    nxt.click()  # → review
    page.screenshot(path=f"{SHOTS}/j_{role}_review.png", full_page=True)
    nxt.click()  # finish
    page.wait_for_url("**/unlock")
    page.wait_for_selector(".pin-input__box")
    page.keyboard.type("2580")
    page.wait_for_timeout(300)
    page.keyboard.type("2580")
    page.wait_for_url("**/home")
    page.wait_for_timeout(1000)

with sync_playwright() as p:
    chrome = os.environ.get("CHROME_PATH")
    browser = p.chromium.launch(**({"executable_path": chrome} if chrome else {}), args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, timezone_id="Africa/Nairobi")
    ctx.add_init_script(INIT)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # ── Journey 1: self-registration ───────────────────────────────────────
    fresh(page)
    page.locator(".btn-ghost").first.click()
    page.wait_for_url("**/register")
    page.goto(f"{BASE}/start")
    fresh(page)
    register(page, "self")
    prof = profile(page)
    check("J1 reaches personalised Home", "/home" in page.url and "Wanjiru" in page.locator(".home2__hello").inner_text())
    check("J1 pregnancy saved with recorded date", prof and prof.get("gaWeeks") == 24 and prof.get("gaDays") == 3 and prof.get("gaRecordedOnMs"))
    check("J1 history saved", prof and prof.get("pastComplications") == ["caesarean"] and prof.get("conditions") == ["high_bp"])
    check("J1 allergies stored one by one (no comma string)", prof.get("allergyList") == [{"code": "penicillin"}, {"code": "other", "name": "Mango"}] and "allergies" not in prof and "noKnownAllergies" not in prof, str(prof.get("allergyList")))
    cons = read_store(page, "consent")[0]
    check("J1 terms acceptance recorded with version and time", cons.get("termsVersion", "").startswith("neema-terms") and cons.get("termsAcceptedAtMs"))
    check("J1 contacts saved as +254", sorted(c["phone"] for c in read_store(page, "contacts")) == ["+254722111234", "+254733987654"])
    check("J1 consent recorded", len(read_store(page, "consent")) == 1)

    # ── Journey 4: daily homepage (same install) ───────────────────────────
    check("J4 pregnancy week + trimester shown", "Week 24" in page.locator(".preg__week").inner_text() and "Trimester 2" in page.locator(".preg__tri").inner_text())
    check("J4 due date shown", "Estimated due date" in page.locator(".preg__due").inner_text())
    tops = [page.locator(sel).first.bounding_box()["y"] for sel in [".home2__hello", ".checkin2", ".preg2", ".reads"]]
    check("J4 order: greeting → check-in → pregnancy card → readings", tops == sorted(tops), str([round(t) for t in tops]))
    check("J4 pregnancy + this week are ONE card", page.locator(".preg2 .preg2__week").count() == 1 and page.locator(".insight").count() == 0)
    check("J4 baby illustration for the week", page.locator(".preg2 svg.baby-art[role=img]").count() == 1 and "24 weeks" in (page.locator(".baby-art").get_attribute("aria-label") or ""))
    check("J4 next WHO clinic visit shown", "week 26" in page.locator(".preg2").inner_text())
    page.get_by_role("button", name="More guidance").click()
    check("J4 more guidance + source + draft label", page.locator("#insight-more").count() == 1 and page.locator(".insight__draft").count() == 1 and page.locator(".insight__src a").count() == 1)
    check("J4 readings link to history", page.get_by_role("link", name="View health history").count() == 1)
    check("J4 three readings rows", page.locator(".read-row").count() == 3)
    check("J4 removed clutter (no KPI tiles, FAB, SOS card)", page.locator(".kpi-tile, .fab, .neema-fab, .sos-btn").count() == 0)
    check("J4 Home has no sideways scroll", no_overflow(page))
    page.screenshot(path=f"{SHOTS}/j4_home.png", full_page=True)
    page.get_by_role("button", name="Start Daily Check-in").click()
    page.wait_for_url("**/care")
    check("J4 daily check-in opens CareChat", "/care" in page.url)
    page.wait_for_timeout(900)  # let the page's rise-in animation finish before measuring
    send = page.locator(".care-chat__composer").first
    nav_box = page.locator(".bottom-nav").bounding_box()
    comp_box = send.bounding_box()
    check("J4 CareChat composer is not covered by the tab bar", comp_box and nav_box and comp_box["y"] + comp_box["height"] <= nav_box["y"] + 1,
          f"composer bottom {comp_box and comp_box['y'] + comp_box['height']:.0f} nav top {nav_box and nav_box['y']:.0f}")

    # ── Journey 5: health history ──────────────────────────────────────────
    page.goto(f"{BASE}/bp")
    page.fill("#sys", "150")
    page.fill("#dia", "96")
    page.get_by_role("button", name="Save").click() if page.get_by_role("button", name="Save").count() else page.locator(".btn-primary").last.click()
    page.wait_for_timeout(1500)
    page.goto(f"{BASE}/home")
    page.wait_for_timeout(1200)
    bp_row = page.locator(".read-row").first.inner_text()
    check("J5 new BP on Home with flag from config", "150/96" in bp_row and "High" in bp_row, bp_row.replace("\n", " "))
    page.locator(".bottom-nav a", has_text="History").click()
    page.wait_for_url("**/history")
    page.wait_for_timeout(800)
    page.screenshot(path=f"{SHOTS}/j5_history.png", full_page=True)
    check("J5 History lists the reading", "150/96" in page.locator("#hist-panel-readings").inner_text(), page.locator("#hist-panel-readings").inner_text()[:120].replace("\n", " | "))
    page.get_by_role("tab", name="Alerts").click()
    check("J5 History alerts tab", page.locator("#hist-panel-alerts").count() == 1)
    check("J5 History has no sideways scroll", no_overflow(page))

    # ── Journey 6: emergency ───────────────────────────────────────────────
    page.goto(f"{BASE}/home")
    page.wait_for_timeout(1000)
    btn = page.get_by_test_id("sos-button")
    box = btn.bounding_box()
    check("J6 emergency button visible at top of Home", box and box["y"] < 120 and box["x"] + box["width"] <= 390, str(box))
    check("J6 emergency button says what it does", "999" in (btn.get_attribute("aria-label") or ""))
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down(); page.wait_for_timeout(500); page.mouse.up()
    page.wait_for_timeout(600)
    check("J6 short tap does nothing", "/home" in page.url)
    page.mouse.down(); page.wait_for_timeout(2400); page.mouse.up()
    page.wait_for_url("**/alert*", timeout=5000)
    page.wait_for_timeout(1500)
    links = page.evaluate("window.__links || []")
    check("J6 hold opens the 999 dialer", "tel:999" in links, str(links))
    check("J6 alert page: RED + Call 999 + SMS to CHP", page.locator(".status-orb").get_attribute("data-level") == "RED"
          and page.get_by_test_id("call-999").count() == 1 and page.locator(".sms-list a").count() >= 1)
    page.screenshot(path=f"{SHOTS}/j6_alert.png", full_page=True)
    page.get_by_text("on my way to the facility", exact=False).first.click()
    page.wait_for_url("**/home")

    # ── Journey 7: PIN unlock ──────────────────────────────────────────────
    page.goto(f"{BASE}/profile#account")
    page.wait_for_timeout(800)
    page.get_by_role("button", name="Lock Neema now").click()
    page.wait_for_url("**/unlock")
    page.wait_for_selector(".pin-input__box")
    boxes = page.locator(".pin-input__box")
    focused = lambda: page.evaluate("document.activeElement && document.activeElement.getAttribute('aria-label')")
    check("J7 four separate boxes, first focused", boxes.count() == 4 and focused() == "Digit 1 of 4", focused())
    page.keyboard.type("25")
    check("J7 focus moves forward", focused() == "Digit 3 of 4", focused())
    page.keyboard.press("Backspace")
    check("J7 backspace goes back and clears", focused() == "Digit 2 of 4" and boxes.nth(1).input_value() == "", focused())
    page.keyboard.press("Backspace")
    page.keyboard.type("1111")
    page.wait_for_timeout(1200)
    check("J7 wrong PIN: clear message, boxes cleared, focus on first", page.locator("#pin-error").count() == 1
          and all(boxes.nth(i).input_value() == "" for i in range(4)) and focused() == "Digit 1 of 4")
    page.evaluate("""() => { const dt = new DataTransfer(); dt.setData('text', '2580');
      document.querySelector('.pin-input__box').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""")
    page.wait_for_url("**/home", timeout=5000)
    check("J7 paste of the right PIN unlocks", "/home" in page.url)

    # ── Journey 8: settings / profile ──────────────────────────────────────
    page.locator(".bottom-nav a", has_text="Profile").click()
    page.wait_for_url("**/profile")
    page.locator("#personal").get_by_role("button", name="Edit").click()
    page.fill("#pf-displayName", "Mama Wanjiru")
    page.fill("#pf-phone", "0712")
    page.locator("#personal").get_by_role("button", name="Save").click()
    check("J8 bad phone rejected in profile", page.locator("#personal .field-error").count() == 1)
    page.fill("#pf-phone", "0712 345 999")
    page.locator("#personal").get_by_role("button", name="Save").click()
    page.wait_for_timeout(500)
    check("J8 personal details saved", profile(page)["displayName"] == "Mama Wanjiru" and profile(page)["phoneForAlerts"] == "+254712345999")
    check("J8 contacts shown with manage link", "Mama Otieno" in page.locator("#contacts").inner_text())
    check("J8 nurse QR, band, PIN, language, consent, delete all present",
          all(page.get_by_text(t, exact=False).count() > 0 for t in ["Show my summary to the nurse", "Your band", "Change PIN", "Language", "Who may get an alert", "Delete my data", "Terms accepted on"]))
    check("J8 team tools not shown to the mother", page.get_by_text("Stage demo", exact=False).count() == 0 and page.get_by_text("Field readiness", exact=False).count() == 0)
    check("J8 notifications honestly marked unavailable", page.get_by_text("Not available yet").count() == 1)
    check("J8 Profile has no sideways scroll", no_overflow(page))
    page.screenshot(path=f"{SHOTS}/j8_profile.png", full_page=True)
    page.get_by_role("button", name="Show my summary to the nurse", exact=False).click()
    page.wait_for_url("**/summary")
    check("J8 nurse QR page opens", page.locator("svg, canvas, img").count() > 0)
    page.goto(f"{BASE}/home")
    page.wait_for_timeout(800)
    check("J8 new name on Home greeting", "Mama Wanjiru" in page.locator(".home2__hello").inner_text())
    for old, new in [("/passport", "/profile"), ("/settings", "/profile"), ("/todo", "/home"), ("/consent", "/register")]:
        page.goto(f"{BASE}{old}")
        page.wait_for_timeout(600)
        check(f"J8 old route {old} redirects", new in page.url or (old == "/consent" and "/home" in page.url), page.url)

    # ── Journey 2: CHW registers a mother with a basic phone ──────────────
    fresh(page)
    page.locator(".btn-ghost").first.click()
    page.wait_for_url("**/register")
    page.locator(".reg-choice").nth(1).click()
    page.locator(".reg-actions .btn-primary").click()
    check("J2 CHW must give their own name", page.locator("#reg-registrar-error").count() == 1)
    fresh(page)
    register(page, "chw", phone_kind="basic")
    prof = profile(page)
    check("J2 registered by CHW with ID", prof["registeredBy"] == {"role": "chw", "name": "Grace Achieng", "staffId": "CHW-0042"}, str(prof.get("registeredBy")))
    check("J2 basic phone + automated-call consent stored", prof.get("phoneKind") == "basic" and prof.get("automatedCallsConsent") is True and prof.get("phoneForAlerts") == "+254712345678")

    # ── Journey 3: nurse registers and records a clinical note ────────────
    fresh(page)
    register(page, "nurse", note="Booking visit. BP 128/82. Hb 11.2 g/dL.")
    notes = read_store(page, "clinicalNotes")
    prof = profile(page)
    check("J3 clinical note stored separately", len(notes) == 1 and notes[0]["authorRole"] == "nurse" and notes[0]["authorName"] == "Grace Achieng")
    check("J3 mother's own notes unchanged", prof.get("healthNotes") == "I get headaches in the evening." and "Hb" not in json.dumps(prof))
    page.goto(f"{BASE}/history#notes")
    page.wait_for_timeout(800)
    panel = page.locator("#hist-panel-notes")
    check("J3 History shows both kinds of notes", "Booking visit" in panel.inner_text() and "headaches" in panel.inner_text())
    nurse_card = panel.locator(".home-card").nth(1)
    check("J3 nurse notes are read-only for her", nurse_card.locator("button, textarea, input").count() == 0)

    # ── Design system: tabs and buttons ───────────────────────────────────
    page.goto(f"{BASE}/history")
    page.wait_for_timeout(800)
    tab = page.get_by_role("tab", name="Readings")
    other = page.get_by_role("tab", name="Visits")
    bg_sel = tab.evaluate("e => getComputedStyle(e).backgroundColor")
    bg_other = other.evaluate("e => getComputedStyle(e).backgroundColor")
    check("Tabs: selected tab has its own colour", tab.get_attribute("aria-selected") == "true" and bg_sel != bg_other, f"{bg_sel} vs {bg_other}")
    other.focus()
    page.keyboard.press("ArrowLeft")
    check("Tabs: arrow keys move between tabs", page.get_by_role("tab", name="Alerts").get_attribute("aria-selected") == "true")
    small = []
    for path in ["/home", "/history", "/profile"]:
        page.goto(f"{BASE}{path}")
        page.wait_for_timeout(700)
        small += page.evaluate("""() => [...document.querySelectorAll('main button, main a.btn')].filter(b => b.offsetParent && !b.closest('.pin-input') && !b.classList.contains('alg__remove'))
          .map(b => ({h: b.getBoundingClientRect().height, t: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 24)})).filter(x => x.h < 40)""")
    check("Buttons: every button is at least 40px tall", not small, str(small[:5]))
    ghost_bg = page.evaluate("() => { const b = document.querySelector('.btn-ghost, .btn-secondary'); return b ? getComputedStyle(b).backgroundColor + '|' + getComputedStyle(b).borderTopWidth : '' }")
    check("Buttons: secondary buttons have a background or border", ghost_bg and not ghost_bg.startswith("rgba(0, 0, 0, 0)|0px"), ghost_bg)

    # ── Small screen: no overflow on 360 px ────────────────────────────────
    page.set_viewport_size({"width": 360, "height": 740})
    for path in ["/home", "/history", "/profile", "/care"]:
        page.goto(f"{BASE}{path}")
        page.wait_for_timeout(800)
        check(f"360px: {path} has no sideways scroll", no_overflow(page))

    check("No page errors", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
