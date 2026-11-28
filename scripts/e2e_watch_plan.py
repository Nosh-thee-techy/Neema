"""Her watch plan: history → what Neema watches, the questions, the CHP SMS, the band.

Usage: pnpm dev, then  python3 scripts/e2e_watch_plan.py [http://localhost:5173]
Needs: pip install playwright (set CHROME_PATH to use an installed Chrome).
"""
import datetime, json, os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
SHOTS = os.environ.get("NEEMA_E2E_SHOTS", "/tmp")
DB = "neema-mama-passport"

results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

def store(page, name):
    return page.evaluate("""(s) => new Promise((res) => {
      const r = indexedDB.open('%s');
      r.onsuccess = () => { const g = r.result.transaction(s).objectStore(s).getAll(); g.onsuccess = () => res(g.result); };
    })""" % DB, name)

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
    page.wait_for_timeout(1200)

def register(page, weeks, first=True, past=(), conditions=()):
    nxt = page.locator(".reg-actions .btn-primary")
    nxt.click()
    page.fill("#reg-full", "Wanjiku Mwangi")
    page.fill("#reg-display", "Wanjiku")
    nxt.click()
    page.fill("#reg-gaw", str(weeks))
    page.select_option("#reg-gad", "0")
    page.get_by_role("radio", name="Yes" if first else "No", exact=True).click()
    for label in past:
        page.get_by_role("button", name=label, exact=True).click()
    nxt.click()
    for label in conditions:
        page.get_by_role("button", name=label, exact=True).click()
    nxt.click()
    page.fill("#reg-chpn", "Grace Achieng")
    page.fill("#reg-chpp", "0722 111 234")
    nxt.click()
    page.locator("#reg-terms").check()
    nxt.click(); nxt.click()
    finish_pin(page)

with sync_playwright() as p:
    kw = {"executable_path": os.environ["CHROME_PATH"]} if os.environ.get("CHROME_PATH") else {}
    browser = p.chromium.launch(**kw)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    # ── W1 first pregnancy, nothing ticked: no card, nothing changes ───────
    fresh(page)
    register(page, 30)
    check("W1 no history: no watch card on Today", page.locator(".watch-card").count() == 0)
    page.goto(f"{BASE}/symptoms"); page.wait_for_timeout(700)
    check("W1 no history: no 'asks you every day' block on Symptoms", page.locator(".watch-ask").count() == 0)

    # ── W2 pregnant after a loss, with high blood pressure before ─────────
    fresh(page)
    register(page, 30, first=False, past=("High blood pressure in pregnancy", "Pregnancy loss"))
    card = page.locator(".watch-card")
    check("W2 Today shows 'What Neema is watching for you'", card.count() == 1 and "What Neema is watching for you" in card.inner_text())
    text = card.inner_text()
    check("W2 the reasons are hers, in plain words", "You have had high blood pressure before." in text and "You lost a pregnancy before" in text, text[:200])
    check("W2 says until the baby is born, never 'high-risk'", "Until your baby is born." in text and "high-risk" not in text.lower() and "high risk" not in text.lower())
    check("W2 blood pressure check due (no reading yet)", page.locator(".watch-card__due").count() == 1 and "Blood pressure check due" in page.locator(".watch-card__due").inner_text())
    page.screenshot(path=f"{SHOTS}/watch_pregnant.png", full_page=True)
    check("W2 no sideways scroll on Today", no_overflow(page))
    page.locator(".watch-card__due").click()
    page.wait_for_url("**/bp")
    check("W2 the due item opens the blood pressure form", "/bp" in page.url)
    page.goto(f"{BASE}/symptoms"); page.wait_for_timeout(700)
    ask = page.locator(".watch-ask")
    chips = [c.strip() for c in ask.locator(".chip").all_inner_texts()]
    check("W2 her daily questions come first on Symptoms", ask.count() == 1 and chips[:1] == ["Headache"] and "Baby moving less" in chips and "Swelling face/hands" in chips, str(chips))
    general = [c.strip() for c in page.locator(".chip-grid").nth(1).locator(".chip").all_inner_texts()]
    check("W2 no question is asked twice", not (set(chips) & set(general)), str(general))
    page.screenshot(path=f"{SHOTS}/watch_symptoms.png", full_page=True)

    # ── W3 after birth: heavy bleeding + transfusion, caesarean ───────────
    page.goto(f"{BASE}/record-birth"); page.wait_for_timeout(700)
    page.fill("#birth-date", days_ago(2))
    page.get_by_role("radio", name="Caesarean").click()
    page.get_by_role("button", name="Heavy bleeding").click()
    page.get_by_role("button", name="Blood transfusion").click()
    page.get_by_role("button", name="Start my recovery care").click()
    page.wait_for_url("**/home"); page.wait_for_timeout(1500)
    text = page.locator(".watch-card").inner_text()
    check("W3 after birth: bleeding reason first, with pulse watched closely", text.find("You bled heavily when you gave birth.") >= 0 and "pulse more closely" in text, text[:240])
    check("W3 caesarean and blood pressure items too; pregnancy items gone",
          "born by operation" in text and "You have had high blood pressure before." in text and "lost a pregnancy" not in text)
    last_day = (datetime.date.today() - datetime.timedelta(days=2) + datetime.timedelta(days=42))
    check("W3 after-birth items end 6 weeks after the birth", f"Until {last_day.day} " in text, text[-200:])
    page.screenshot(path=f"{SHOTS}/watch_after_birth.png", full_page=True)
    base = {r["id"]: r for r in store(page, "baseline")}
    check("W3 settled pulse restarts at birth", "hr_ref" not in base or base["hr_ref"]["samples"] < 5, str(base.get("hr_ref")))

    page.goto(f"{BASE}/recovery-check"); page.wait_for_timeout(600)
    nxt = page.locator(".reg-actions .btn-primary")
    page.locator(".reg-choice", has_text="Okay").first.click(); nxt.click()
    page.locator(".reg-choice", has_text="About the same").first.click(); nxt.click()
    page.wait_for_timeout(300)
    first_three = [c.strip() for c in page.locator(".rcq-dangers .chip").all_inner_texts()][:3]
    check("W3 after-birth check-in puts her signs first, with the reason",
          first_three[:2] == ["Fainted, or nearly fainted", "Chest pain or hard to breathe"] and "You bled heavily" in page.locator(".watch-ask__why").inner_text(), str(first_three))

    # ── W4 the CHP heads-up says why; quiet mode setting ──────────────────
    page.goto(f"{BASE}/settings"); page.wait_for_timeout(700)
    quiet = page.get_by_label("Quiet alerts when I am out")
    check("W4 'Quiet alerts when I am out' is off by default", quiet.count() == 1 and not quiet.is_checked())
    quiet.check(); page.wait_for_timeout(200)
    check("W4 quiet setting saved on this phone", page.evaluate("localStorage.getItem('neema.quietWhenOut')") == "1")
    page.goto(f"{BASE}/symptoms"); page.wait_for_timeout(700)
    page.get_by_role("button", name="Fever / chills").first.click()
    page.get_by_role("button", name="Save").click()
    page.wait_for_url("**/alert"); page.wait_for_timeout(2500)
    alerts = store(page, "alerts")
    body = alerts[-1].get("smsBody", "") if alerts else ""
    check("W4 YELLOW heads-up to the CHP says why she is watched closely",
          "yuko YELLOW" in body and "Anaangaliwa kwa karibu: alitoka damu nyingi alipojifungua." in body, body)
    page.goto(f"{BASE}/chase"); page.wait_for_timeout(800)
    check("W4 health-team list shows why she is watched", "Watched more closely" in page.locator("main").inner_text() and "You bled heavily" in page.locator("main").inner_text())

    # ── W5 6 weeks later the after-birth items are gone ───────────────────
    page.goto(f"{BASE}/record-birth"); page.wait_for_timeout(700)
    page.fill("#birth-date", days_ago(50))
    page.get_by_role("button", name="Save changes").click()
    page.wait_for_url("**/home"); page.wait_for_timeout(1500)
    check("W5 after 6 weeks Neema eases back (no after-birth items)", page.locator(".watch-card").count() == 0)

    for path in ["/home", "/symptoms", "/recovery-check", "/settings", "/chase"]:
        page.set_viewport_size({"width": 360, "height": 780})
        page.goto(f"{BASE}{path}"); page.wait_for_timeout(600)
        check(f"360px: {path} has no sideways scroll", no_overflow(page))
    check("No page errors", not errors, "; ".join(errors[:3]))
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
