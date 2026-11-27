"""After-birth journeys: pregnancy → record birth → recovery dashboard → check-ins.

Usage: pnpm dev, then  python3 scripts/e2e_postpartum.py [http://localhost:5173]
Needs: pip install playwright (set CHROME_PATH to use an installed Chrome).
"""
import datetime, json, os, sys
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

def store(page, name):
    return page.evaluate("""(s) => new Promise((res) => {
      const r = indexedDB.open('%s');
      r.onsuccess = () => { const g = r.result.transaction(s).objectStore(s).getAll(); g.onsuccess = () => res(g.result); };
    })""" % DB, name)

def profile(page):
    rows = store(page, "profile")
    return json.loads(rows[0]["payload"]) if rows else None

def days_ago(n):
    return (datetime.date.today() - datetime.timedelta(days=n)).isoformat()

def no_overflow(page):
    return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

def fresh(page):
    page.goto(f"{BASE}/start")
    page.evaluate("localStorage.clear(); sessionStorage.clear(); localStorage.setItem('neema.lang.v1','en')")
    page.evaluate("new Promise(r=>{const q=indexedDB.deleteDatabase('%s');q.onsuccess=q.onerror=q.onblocked=()=>r(1)})" % DB)
    page.goto(f"{BASE}/start")
    page.wait_for_url("**/orient")
    page.locator(".btn-ghost").first.click()
    page.wait_for_url("**/register")

def finish_pin(page):
    page.wait_for_url("**/unlock")
    page.wait_for_selector(".pin-input__box")
    page.keyboard.type("2580")
    page.wait_for_timeout(300)
    page.keyboard.type("2580")
    page.wait_for_url("**/home")
    page.wait_for_timeout(1000)

def register_pregnant(page):
    nxt = page.locator(".reg-actions .btn-primary")
    nxt.click()
    page.fill("#reg-full", "Wanjiru Kamau")
    page.fill("#reg-display", "Wanjiru")
    nxt.click()
    page.fill("#reg-gaw", "39")
    page.select_option("#reg-gad", "2")
    page.get_by_role("radio", name="Yes", exact=True).click()
    nxt.click(); nxt.click()
    page.fill("#reg-chpn", "Grace Achieng")
    page.fill("#reg-chpp", "0722 111 234")
    nxt.click()
    page.locator("#reg-terms").check()
    nxt.click(); nxt.click()
    finish_pin(page)

def checkin(page, physical="Good", bleeding="Getting lighter", dangers=(), mood="Good", harm=None, sleep="5 to 6 hours"):
    page.goto(f"{BASE}/recovery-check")
    page.wait_for_timeout(500)
    nxt = page.locator(".reg-actions .btn-primary")
    page.locator(".reg-choice", has_text=physical).first.click()
    nxt.click()
    page.get_by_role("radio", name=bleeding).click()
    nxt.click()
    if dangers:
        for d in dangers:
            page.get_by_role("button", name=d).click()
    else:
        page.get_by_role("button", name="None of these").click()
    nxt.click()
    page.get_by_role("radio", name=mood, exact=True).click()
    page.wait_for_timeout(200)
    if page.locator(".reg-card h1", has_text="A little more").count():
        fields = page.locator(".reg-card .field")
        if mood in ("Low", "Very low"):
            fields.nth(0).get_by_role("radio", name="No").click()
            fields.nth(1).get_by_role("radio", name="No").click()
            page.get_by_role("radio", name="Some").click()
            fields.nth(3).get_by_role("radio", name="Yes" if harm else "No").click()
        else:
            page.get_by_role("radio", name="Yes", exact=True).first.click()
        nxt.click()
        if harm:
            page.wait_for_timeout(1500)
            return
    page.get_by_role("radio", name=sleep).click()
    page.wait_for_timeout(200)
    if page.locator(".reg-card h1", has_text="About your rest").count():
        fields = page.locator(".reg-card .field")
        fields.nth(0).get_by_role("radio", name="No").click()
        fields.nth(1).get_by_role("radio", name="No").click()
        nxt.click()
    page.wait_for_timeout(1500)

with sync_playwright() as p:
    chrome = os.environ.get("CHROME_PATH")
    browser = p.chromium.launch(**({"executable_path": chrome} if chrome else {}), args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, timezone_id="Africa/Nairobi")
    ctx.add_init_script(INIT)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # ── P1 pregnancy → record the birth ─────────────────────────────────────
    fresh(page)
    register_pregnant(page)
    check("P1 pregnant mother at 39 weeks is offered 'Record the birth'", page.get_by_role("button", name="Record the birth").count() == 1)
    before = profile(page)
    page.get_by_role("button", name="Record the birth").click()
    page.wait_for_url("**/record-birth")
    page.get_by_role("button", name="Start my recovery care").click()
    check("P1 birth date and how the baby was born are required", page.locator("#birth-date-error").count() == 1 and page.locator("#birth-mode-error").count() == 1)
    page.fill("#birth-date", days_ago(-1))
    page.get_by_role("radio", name="Caesarean").click()
    page.get_by_role("button", name="Start my recovery care").click()
    check("P1 a future birth date is refused", "future" in page.locator("#birth-date-error").inner_text())
    page.fill("#birth-date", days_ago(12))
    page.get_by_role("radio", name="Health facility").click()
    page.fill("#birth-fac", "Kawangware Health Centre")
    page.get_by_role("button", name="Heavy bleeding").click()
    page.fill("#birth-name-0", "Amani")
    page.get_by_role("button", name="Start my recovery care").click()
    page.wait_for_url("**/home")
    page.wait_for_timeout(1500)
    after = profile(page)
    check("P1 stage moved to postpartum with the delivery record", after["stage"] == "postpartum" and after["delivery"]["dateIso"] == days_ago(12) and after["delivery"]["mode"] == "caesarean")
    check("P1 pregnancy records kept (weeks, due date, first pregnancy)", all(after.get(k) == before.get(k) for k in ["gaWeeks", "gaDays", "gaRecordedOnMs", "expectedDeliveryDate", "firstPregnancy"]))
    check("P1 pregnancy length at birth saved for history", after["delivery"].get("gestationAtBirth", {}).get("weeks") == 37, str(after["delivery"].get("gestationAtBirth")))
    babies = store(page, "babies")
    check("P1 baby kept as its own record", len(babies) == 1 and babies[0]["name"] == "Amani" and "name" not in json.dumps(after["delivery"]))

    # ── P2 the recovery dashboard ──────────────────────────────────────────
    page.screenshot(path=f"{SHOTS}/pp_home.png", full_page=True)
    check("P2 greeting + days since birth + baby's age", "Wanjiru" in page.locator(".home2__hello").inner_text()
          and "Day 12 of your recovery" in page.locator(".rec-welcome").inner_text() and "Amani: 12 days old" in page.locator(".rec-welcome").inner_text())
    check("P2 reassuring recovery message", "12 days into your recovery" in page.locator(".rec-welcome__msg").inner_text())
    check("P2 bell and emergency hold still in the header", page.locator(".home2__bell").count() == 1 and page.get_by_test_id("sos-button").count() == 1)
    tops = [page.locator(sel).first.bounding_box()["y"] for sel in [".rec-welcome", ".checkin2", ".rec-expect", ".reads", ".rec-baby"]]
    check("P2 order: welcome → check-in → what to expect → readings → baby", tops == sorted(tops), str([round(t) for t in tops]))
    check("P2 check-in asks about her body", "How are you and your body feeling today?" in page.locator(".checkin2").inner_text())
    exp = page.locator(".rec-expect")
    check("P2 'Your Recovery: What to Expect' shows her stage (day 12 → Week 2)", "Your Recovery: What to Expect" in exp.inner_text() and "Week 2" in page.locator(".rec-stage-nav__mid").inner_text() and page.locator(".rec-now").count() == 1)
    check("P2 normal vs emergency vs today are separate", page.locator(".rec-normal li").count() >= 3 and page.locator(".rec-emergency li").count() >= 7 and page.locator(".rec-today li").count() >= 6)
    check("P2 caesarean-specific advice is not shown when the stage has none, draft label shown", page.locator(".rec-expect .insight__draft").count() == 1)
    check("P2 next WHO postnatal check shown", "day 7 and day 14" in exp.inner_text())
    page.get_by_role("button", name="Next stage").click()
    check("P2 can explore a later stage", "Weeks 3 and 4" in page.locator(".rec-stage-nav__mid").inner_text() and page.locator(".rec-now").count() == 0)
    page.get_by_role("button", name="Back to my stage").click()
    check("P2 'Back to my stage' returns", "Week 2" in page.locator(".rec-stage-nav__mid").inner_text())
    reads = page.locator(".reads").inner_text()
    check("P2 readings: heart rate, BP, skin temperature (labelled), sleep", all(t in reads for t in ["Heart rate", "Blood pressure", "Skin temperature (band)", "Sleep last night"]))
    check("P2 no made-up readings", page.locator(".read-row__value", has_text="—").count() == 4)
    check("P2 baby section is secondary and closed", page.locator(".rec-baby #rec-baby-body").count() == 0 and "Your Baby's First Weeks" in page.locator(".rec-baby").inner_text())
    page.locator(".rec-baby").get_by_role("button", name="Open").click()
    check("P2 baby section: newborn danger signs + next vaccine visit", page.locator(".rec-baby .rec-emergency li").count() >= 6 and "6 weeks" in page.locator(".rec-baby").inner_text())
    nav_labels = page.locator(".bottom-nav a").all_inner_texts()
    check("P2 navigation: Recovery, Sleep & mood, CareChat, History, Profile", [n.strip() for n in nav_labels] == ["Recovery", "Sleep & mood", "CareChat", "History", "Profile"], str(nav_labels))
    check("P2 no sideways scroll", no_overflow(page))

    # ── P3 content follows the real birth date ─────────────────────────────
    for n, stage_title in [(1, "The first 24 hours"), (5, "Days 2 to 7"), (18, "Weeks 3 and 4"), (45, "Weeks 7 and 8")]:
        page.goto(f"{BASE}/record-birth")
        page.wait_for_timeout(600)
        page.fill("#birth-date", days_ago(n))
        page.get_by_role("button", name="Save changes").click()
        page.wait_for_url("**/home")
        page.wait_for_timeout(1000)
        check(f"P3 day {n} shows '{stage_title}'", stage_title in page.locator(".rec-stage-nav__mid").inner_text())
    check("P3 caesarean note appears where the stage has one", page.locator(".rec-cs").count() == 0)  # weeks 7-8 has none
    page.goto(f"{BASE}/record-birth"); page.wait_for_timeout(600)
    page.fill("#birth-date", days_ago(5)); page.get_by_role("button", name="Save changes").click(); page.wait_for_url("**/home"); page.wait_for_timeout(1000)
    check("P3 caesarean advice shown in days 2-7", page.locator(".rec-cs").count() == 1)

    # ── P4 calm daily check-in ─────────────────────────────────────────────
    checkin(page)
    check("P4 calm check-in: thank you, nothing urgent", "Thank you for checking in" in page.locator(".rcq-result").inner_text())
    rows = store(page, "recoveryCheckins")
    check("P4 check-in saved with day after birth", len(rows) == 1 and rows[0]["dayAfterBirth"] == 5 and rows[0]["dangerCodes"] == [])
    page.goto(f"{BASE}/home"); page.wait_for_timeout(1000)
    check("P4 Home shows today's answers and 'Check in again'", page.get_by_role("button", name="Check in again").count() == 1 and "Sleep" in page.locator(".rec-summary").inner_text())
    check("P4 sleep reading now filled from her answer", "5–6 h" in page.locator(".reads").inner_text())

    # ── P5 review-today sign (wound) ───────────────────────────────────────
    checkin(page, physical="Not well", dangers=["Stitches or wound red, swollen or leaking"])
    check("P5 wound problem → see a health worker today (YELLOW)", "See a health worker today" in page.locator(".rcq-result").inner_text())

    # ── P6 emergency sign ──────────────────────────────────────────────────
    checkin(page, physical="Not well", dangers=["Fainted, or nearly fainted"])
    res = page.locator(".rcq-result")
    check("P6 fainting → get help now with Call 999", "Get help now" in res.inner_text() and res.get_by_role("link", name="Call 999").count() == 1)
    page.get_by_role("button", name="Alert my CHP and see steps").click()
    page.wait_for_url("**/alert*")
    page.wait_for_timeout(1200)
    check("P6 alert page is RED with SMS to the CHP prepared", page.locator(".status-orb").get_attribute("data-level") == "RED" and page.locator(".sms-list a").count() >= 1)

    # ── P7 thoughts of harm ───────────────────────────────────────────────
    checkin(page, mood="Very low", harm=True)
    res = page.locator(".rcq-result")
    check("P7 thoughts of harm → talk to someone now, 1199 and CHP", "Please talk to someone now" in res.inner_text()
          and res.locator('a[href="tel:1199"]').count() == 1 and res.locator('a[href="tel:+254722111234"]').count() == 1)
    symptoms = store(page, "symptoms")
    check("P7 saved as a symptom so the alert chain runs", any("thoughts_of_harm" in s["codes"] for s in symptoms))
    page.get_by_role("button", name="Open the message to my CHP").click()
    page.wait_for_url("**/alert*")
    page.wait_for_timeout(1000)
    sms = " ".join(page.locator(".sms-list a").evaluate_all("els => els.map(a => decodeURIComponent(a.getAttribute('href')))"))
    check("P7 the SMS does not say why (privacy)", sms and "harm" not in sms.lower(), sms[:160])

    # ── P8 sleep & mood ───────────────────────────────────────────────────
    page.goto(f"{BASE}/wellbeing"); page.wait_for_timeout(900)
    check("P8 Sleep & mood shows reported sleep and mood", page.locator(".wb-bar").count() >= 3 and page.locator(".wb-dot").count() >= 3)
    check("P8 EPDS mood check and support lines", page.get_by_role("button", name="Take the mood check").count() == 1 and page.locator('a[href="tel:1199"]').count() == 1)
    check("P8 no sideways scroll", no_overflow(page))

    # ── P9 history, profile, toggles, undo ────────────────────────────────
    page.goto(f"{BASE}/history"); page.wait_for_timeout(900)
    check("P9 History lists recovery check-ins", page.locator(".hist-list li", has_text="Day 5").count() >= 1)
    page.get_by_role("tab", name="Visits").click()
    check("P9 History shows the birth", "Baby born" in page.locator("#hist-panel-visits").inner_text())
    page.goto(f"{BASE}/profile"); page.wait_for_timeout(900)
    check("P9 Profile: Birth section + completed pregnancy", page.locator("#birth").count() == 1 and "Pregnancy (completed)" in page.locator("#pregnancy").inner_text() and "38 weeks" in page.locator("#pregnancy").inner_text(), page.locator("#pregnancy").inner_text().replace("\n", " | ")[:200])
    page.locator("#birth").get_by_text("Show baby care tips").click()
    page.wait_for_timeout(500)
    page.goto(f"{BASE}/home"); page.wait_for_timeout(1000)
    check("P9 baby tips can be turned off", page.locator(".rec-baby").count() == 0 and "days old" not in page.locator(".rec-welcome").inner_text())
    page.goto(f"{BASE}/summary"); page.wait_for_timeout(1000)
    check("P9 nurse summary still opens", page.locator("svg, canvas, img").count() > 0)
    page.goto(f"{BASE}/profile#birth"); page.wait_for_timeout(900)
    page.get_by_role("button", name="Recorded by mistake? Undo").click()
    page.wait_for_timeout(300)
    page.screenshot(path=f"{SHOTS}/pp_undo.png", full_page=True)
    print("undo buttons:", page.locator(".prof-danger button").all_inner_texts())
    page.locator(".prof-danger").get_by_role("button", name="Undo", exact=True).click()
    page.wait_for_timeout(1000)
    p_after = profile(page)
    check("P9 undo returns to pregnancy with pregnancy data intact", p_after["stage"] == "pregnancy" and "delivery" not in p_after and p_after.get("gaWeeks") == 39)
    page.goto(f"{BASE}/home"); page.wait_for_timeout(1000)
    check("P9 pregnancy dashboard back after undo", page.locator(".preg2 .preg__week").count() == 1 and [n.strip() for n in page.locator(".bottom-nav a").all_inner_texts()][0] == "Home")

    # ── P10 registering after birth ───────────────────────────────────────
    fresh(page)
    nxt = page.locator(".reg-actions .btn-primary")
    nxt.click()
    page.fill("#reg-full", "Achieng Otieno")
    nxt.click()
    page.get_by_role("radio", name="Gave birth recently").click()
    nxt.click()
    check("P10 registering after birth requires the birth date and how", page.locator("#reg-birth-date-error").count() == 1 and page.locator("#reg-mode-error").count() == 1)
    page.fill("#reg-birth-date", days_ago(3))
    page.get_by_role("radio", name="Normal birth").click()
    nxt.click(); nxt.click()
    page.fill("#reg-chpn", "Grace Achieng"); page.fill("#reg-chpp", "0722 111 234")
    nxt.click()
    page.locator("#reg-terms").check()
    nxt.click(); nxt.click()
    finish_pin(page)
    check("P10 lands on the recovery dashboard at day 3", "Day 3 of your recovery" in page.locator(".rec-welcome").inner_text() and "Days 2 to 7" in page.locator(".rec-stage-nav__mid").inner_text())

    page.set_viewport_size({"width": 360, "height": 740})
    for path in ["/home", "/recovery-check", "/wellbeing", "/record-birth"]:
        page.goto(f"{BASE}{path}"); page.wait_for_timeout(800)
        check(f"360px: {path} has no sideways scroll", no_overflow(page))

    check("No page errors", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
