#!/usr/bin/env python3
"""86 Chaos Python operations intelligence engine.

Standard-library only so it can run without Python package installs.
Reads JSON on stdin and writes JSON on stdout.
This is a behind-the-scenes analysis layer: it suggests, warns, and reports.
It never writes orders, changes pars, sends vendor orders, edits schedules, or changes staff records.
"""
import json
import math
import re
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, date, timezone
from typing import Any, Dict, List, Tuple

DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())).strip()


def title(value: Any) -> str:
    raw = str(value or "").strip()
    return raw[:1].upper() + raw[1:] if raw else ""


def tokens(value: Any) -> List[str]:
    out = []
    for token in clean(value).split():
        if len(token) > 4 and token.endswith("ies"):
            token = token[:-3] + "y"
        elif len(token) > 4 and token.endswith("es"):
            token = token[:-2]
        elif len(token) > 4 and token.endswith("s"):
            token = token[:-1]
        if len(token) > 2:
            out.append(token)
    return out


def text_score(query: Any, candidate: Any) -> int:
    q = tokens(query)
    c = tokens(candidate)
    if not q or not c:
        return 0
    q_text = " ".join(q)
    c_text = " ".join(c)
    score = 0
    if q_text == c_text:
        score += 100
    if q_text in c_text or c_text in q_text:
        score += 45
    for token in q:
        if token in c:
            score += 18
        elif any(token in other or other in token for other in c):
            score += 8
    return score


def num(value: Any, default: float = 0.0) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    try:
        raw = re.sub(r"[^0-9.\-]", "", str(value or ""))
        return float(raw) if raw not in ("", "-", ".") else default
    except Exception:
        return default


def date_key(value: Any) -> str:
    if not value:
        return ""
    raw = str(value)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date().isoformat()
    except Exception:
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").date().isoformat()
        except Exception:
            return ""


def add_days(key: str, days: int) -> str:
    return (datetime.strptime(key, "%Y-%m-%d").date() + timedelta(days=days)).isoformat()


def days_between(start: str, end: str) -> int:
    try:
        return (datetime.strptime(end, "%Y-%m-%d").date() - datetime.strptime(start, "%Y-%m-%d").date()).days
    except Exception:
        return 0


def item_name(item: Dict[str, Any]) -> str:
    return str(item.get("name") or item.get("itemName") or item.get("title") or item.get("text") or "")


def line_text(row: Dict[str, Any]) -> str:
    return " ".join(str(row.get(k) or "") for k in ("itemName", "name", "description", "productCode", "sku", "pfgCode", "packSize", "unit"))


def invoice_rows_for_item(item: Dict[str, Any], invoices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    label = item_name(item)
    item_id = str(item.get("id") or "")
    rows = []
    for inv in invoices or []:
        inv_date = date_key(inv.get("invoiceDate") or inv.get("processedAt") or inv.get("createdAt") or inv.get("date"))
        vendor = inv.get("vendorName") or inv.get("supplierName") or inv.get("vendor") or ""
        for row in inv.get("lineItems") or inv.get("rows") or []:
            matched_id = str(row.get("matchedItemId") or row.get("matchId") or row.get("itemId") or row.get("inventoryItemId") or "")
            if (item_id and matched_id == item_id) or text_score(label, line_text(row)) >= 55:
                qty = max(1.0, num(row.get("quantity") or row.get("qty"), 1.0))
                total = num(row.get("total") or row.get("lineTotal") or row.get("extendedPrice") or row.get("totalPrice"), 0.0)
                unit_price = num(row.get("unitPrice"), 0.0)
                if unit_price <= 0 and total > 0:
                    unit_price = total / qty
                rows.append({"date": inv_date, "qty": qty, "total": total, "unitPrice": unit_price, "vendor": vendor, "packSize": row.get("packSize") or row.get("unit") or "", "raw": row, "invoiceId": inv.get("id") or ""})
    return sorted(rows, key=lambda r: r.get("date") or "", reverse=True)


def analyze_price_watch(items: List[Dict[str, Any]], invoices: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    price_watch = []
    invoice_anomalies = []
    invoice_fingerprints = Counter()
    for inv in invoices or []:
        key = clean(f"{inv.get('vendorName') or inv.get('supplierName') or inv.get('vendor') or ''}|{date_key(inv.get('invoiceDate') or inv.get('date') or inv.get('createdAt'))}|{num(inv.get('total') or inv.get('grandTotal'), 0)}")
        if key.strip("|"):
            invoice_fingerprints[key] += 1
    for fp, count in invoice_fingerprints.items():
        if count > 1:
            invoice_anomalies.append({"severity": "medium", "type": "possible_duplicate_invoice", "title": "Possible duplicate invoice", "detail": f"{count} invoices share the same vendor/date/total fingerprint.", "recommendation": "Review invoice history before approving costs or order drafts."})

    for item in items or []:
        rows = invoice_rows_for_item(item, invoices)
        if len(rows) >= 2:
            latest = rows[0]
            previous = next((r for r in rows[1:] if r.get("unitPrice", 0) > 0 and r.get("date") != latest.get("date")), rows[1])
            lp = latest.get("unitPrice") or 0
            pp = previous.get("unitPrice") or 0
            if lp > 0 and pp > 0:
                change = ((lp - pp) / pp) * 100
                if abs(change) >= 8:
                    price_watch.append({
                        "itemId": item.get("id") or "",
                        "itemName": item_name(item),
                        "latestPrice": round(lp, 2),
                        "previousPrice": round(pp, 2),
                        "changePct": round(change, 1),
                        "direction": "up" if change > 0 else "down",
                        "latestDate": latest.get("date"),
                        "previousDate": previous.get("date"),
                        "severity": "high" if abs(change) >= 20 else "medium",
                        "summary": f"{item_name(item)} is {'up' if change > 0 else 'down'} {abs(change):.0f}% from the previous invoice price."
                    })
            pack_values = [clean(r.get("packSize") or "") for r in rows[:8] if clean(r.get("packSize") or "")]
            if len(set(pack_values)) >= 2:
                invoice_anomalies.append({"severity": "low", "type": "pack_size_changed", "itemId": item.get("id") or "", "itemName": item_name(item), "title": f"Pack size changed for {item_name(item)}", "detail": f"Recent invoices show multiple pack sizes: {', '.join(sorted(set(pack_values))[:4])}.", "recommendation": "Confirm the catalog pack size before trusting price or par math."})
    price_watch.sort(key=lambda row: -abs(row.get("changePct", 0)))
    return price_watch[:60], invoice_anomalies[:60]


def waste_for_item(item: Dict[str, Any], waste_logs: List[Dict[str, Any]], current: str, days: int = 45) -> Tuple[float, int, Counter]:
    start = add_days(current, -days)
    item_id = str(item.get("id") or "")
    total = 0.0
    count = 0
    reasons = Counter()
    for log in waste_logs or []:
        key = date_key(log.get("date") or log.get("timestamp") or log.get("createdAt"))
        if not key or key < start or key > current:
            continue
        if (item_id and str(log.get("itemId") or "") == item_id) or text_score(item_name(item), log.get("itemName") or "") >= 55:
            amount = num(log.get("stockDeducted"), num(log.get("qty"), 0.0))
            total += amount
            count += 1
            reasons[title(log.get("reason") or log.get("category") or "Unspecified")] += 1
    return total, count, reasons


def analyze_waste_and_par(items: List[Dict[str, Any]], waste_logs: List[Dict[str, Any]], invoices: List[Dict[str, Any]], current: str, days_ahead: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    waste = []
    pars = []
    for item in items or []:
        par = num(item.get("parLevel"), 0.0)
        stock = num(item.get("currentStock"), 0.0)
        rows = invoice_rows_for_item(item, invoices)
        recent = [r for r in rows if r.get("date") and add_days(current, -60) <= r.get("date") <= current]
        qtys = [r.get("qty", 0.0) for r in recent if r.get("qty", 0.0) > 0]
        weekly_velocity = round(sum(qtys) / max(1, min(60, max(7, days_between(recent[-1]["date"], current) if recent else 7))) * 7, 2) if qtys else 0.0
        waste_total, waste_count, reasons = waste_for_item(item, waste_logs, current)
        if waste_total >= max(2.0, par * 0.45):
            top_reason = reasons.most_common(1)[0][0] if reasons else "Unspecified"
            waste.append({"itemId": item.get("id") or "", "itemName": item_name(item), "recentWaste": round(waste_total, 2), "count": waste_count, "topReason": top_reason, "severity": "high" if waste_total >= max(4.0, par) else "medium", "suggestion": "Review prep level, par, and ordering pattern before increasing quantity."})
        if par > 0 and weekly_velocity > 0:
            ideal = max(1, math.ceil((weekly_velocity / 7.0) * max(3, days_ahead) * 1.20))
            if abs(ideal - par) >= max(2, par * 0.25):
                pars.append({"itemId": item.get("id") or "", "itemName": item_name(item), "currentPar": par, "suggestedPar": ideal, "direction": "raise" if ideal > par else "lower", "weeklyVelocity": weekly_velocity, "stock": stock, "confidence": min(95, 35 + len(qtys) * 8), "reason": f"Recent invoice velocity is about {weekly_velocity:g}/week."})
    waste.sort(key=lambda row: -row.get("recentWaste", 0))
    pars.sort(key=lambda row: (-row.get("confidence", 0), row.get("itemName") or ""))
    return waste[:60], pars[:60]


def recipe_ingredient_cost(name: str, items: List[Dict[str, Any]], invoices: List[Dict[str, Any]]) -> Tuple[float, str]:
    best = None
    best_score = 0
    for item in items or []:
        score = text_score(name, item_name(item))
        if score > best_score:
            best = item
            best_score = score
    if not best or best_score < 32:
        return 0.0, "No inventory match"
    rows = invoice_rows_for_item(best, invoices)
    price = rows[0].get("unitPrice", 0.0) if rows else num(best.get("price"), 0.0)
    return max(0.0, price), item_name(best)


def analyze_menu_costing(recipes: List[Dict[str, Any]], items: List[Dict[str, Any]], invoices: List[Dict[str, Any]], deps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = []
    for recipe in (recipes or [])[:160]:
        recipe_name = recipe.get("title") or recipe.get("name") or recipe.get("menuItemName") or "Recipe"
        price = num(recipe.get("menuPrice") or recipe.get("price") or recipe.get("sellPrice"), 0.0)
        ingredients = recipe.get("ingredients") or recipe.get("items") or []
        ingredient_names = []
        if isinstance(ingredients, list):
            for ing in ingredients[:40]:
                if isinstance(ing, dict):
                    ingredient_names.append(str(ing.get("name") or ing.get("itemName") or ing.get("ingredient") or ""))
                else:
                    ingredient_names.append(str(ing or ""))
        if not ingredient_names:
            for dep in deps or []:
                if text_score(recipe_name, dep.get("menuItemName") or dep.get("recipeName") or "") >= 60:
                    ingredient_names.append(str(dep.get("inventoryItemName") or dep.get("ingredientName") or dep.get("ingredient") or ""))
        cost = 0.0
        matched = []
        missing = []
        for ing_name in [x for x in ingredient_names if x][:30]:
            ing_cost, matched_name = recipe_ingredient_cost(ing_name, items, invoices)
            if ing_cost > 0:
                cost += ing_cost
                matched.append(matched_name)
            else:
                missing.append(ing_name)
        if cost <= 0 and not missing:
            continue
        food_cost_pct = round((cost / price) * 100, 1) if price > 0 else None
        severity = "high" if food_cost_pct and food_cost_pct >= 38 else "medium" if food_cost_pct and food_cost_pct >= 32 else "low"
        out.append({"recipeId": recipe.get("id") or "", "recipeName": recipe_name, "menuPrice": price, "estimatedCost": round(cost, 2), "foodCostPct": food_cost_pct, "matchedIngredients": sorted(set(matched))[:12], "missingIngredients": sorted(set(missing))[:12], "severity": severity, "summary": f"{recipe_name}: estimated cost ${cost:.2f}" + (f" / {food_cost_pct}% food cost" if food_cost_pct is not None else " because no menu price is saved")})
    out.sort(key=lambda row: (row.get("foodCostPct") is None, -(row.get("foodCostPct") or 0), row.get("recipeName") or ""))
    return out[:80]


def shift_hours(shift: Dict[str, Any]) -> float:
    start = str(shift.get("startTime") or "")
    end = str(shift.get("endTime") or "")
    try:
        sh, sm = [int(x) for x in start.split(":")[:2]]
        eh, em = [int(x) for x in end.split(":")[:2]]
        hours = (eh + em / 60) - (sh + sm / 60)
        if hours < 0:
            hours += 24
        return round(max(0.0, min(18.0, hours)), 2)
    except Exception:
        return 0.0


def analyze_labor(users: List[Dict[str, Any]], shifts: List[Dict[str, Any]], time_punches: List[Dict[str, Any]], availability: List[Dict[str, Any]], time_off: List[Dict[str, Any]], current: str) -> List[Dict[str, Any]]:
    warnings = []
    active_user_ids = {str(u.get("id") or u.get("userId") or "") for u in users or [] if u.get("isActive") is not False}
    week_end = add_days(current, 14)
    hours_by_user = defaultdict(float)
    shifts_by_user_day = Counter()
    for s in shifts or []:
        key = date_key(s.get("date"))
        uid = str(s.get("employeeId") or s.get("userId") or "")
        if not key or key < current or key > week_end:
            continue
        if uid and uid not in active_user_ids:
            warnings.append({"severity": "high", "type": "inactive_staff_scheduled", "title": "Inactive or missing staff scheduled", "detail": f"{s.get('employeeName') or uid} has a shift on {key} but is not active in the roster.", "recommendation": "Review Schedule Builder before publishing or exporting."})
        hours_by_user[uid] += shift_hours(s)
        shifts_by_user_day[(uid, key)] += 1
    user_lookup = {str(u.get("id") or u.get("userId") or ""): u for u in users or []}
    for uid, hrs in hours_by_user.items():
        user = user_lookup.get(uid, {})
        max_hrs = num(user.get("maxHoursPerWeek") or user.get("targetMaxHours"), 0.0)
        if max_hrs and hrs > max_hrs:
            warnings.append({"severity": "medium", "type": "over_max_hours", "title": "Staff member over max hours", "detail": f"{user.get('name') or uid} is scheduled for {hrs:g} hours against a max of {max_hrs:g}.", "recommendation": "Adjust schedule or record a manager override reason."})
    for (uid, key), count in shifts_by_user_day.items():
        if count > 1:
            user = user_lookup.get(uid, {})
            warnings.append({"severity": "medium", "type": "multiple_same_day_shifts", "title": "Multiple shifts on one day", "detail": f"{user.get('name') or uid} has {count} shifts on {key}.", "recommendation": "Confirm this is intentional."})
    pending_time_off = [r for r in time_off or [] if clean(r.get("status")) == "pending"]
    for req in pending_time_off[:40]:
        req_start = date_key(req.get("startDate") or req.get("date"))
        req_end = date_key(req.get("endDate") or req.get("date") or req_start) or req_start
        if req_start and req_start <= week_end and req_end >= current:
            warnings.append({"severity": "medium", "type": "pending_request_off", "title": "Pending request-off overlaps schedule window", "detail": f"{req.get('employeeName') or req.get('userName') or 'Employee'} has a pending request from {req_start} to {req_end}.", "recommendation": "Approve, deny, or flag it before schedule review."})
    missing_punch_out = [p for p in time_punches or [] if date_key(p.get("date") or p.get("clockInAt")) >= add_days(current, -7) and (p.get("clockInAt") or p.get("clockIn")) and not (p.get("clockOutAt") or p.get("clockOut"))]
    if missing_punch_out:
        warnings.append({"severity": "high", "type": "open_punches", "title": "Open time punches", "detail": f"{len(missing_punch_out)} recent punch(es) are missing clock-out times.", "recommendation": "Review Financials > Timesheets before payroll."})
    return warnings[:80]


def analyze_data_health(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = []
    items = payload.get("inventoryItems") or []
    vendors = payload.get("vendors") or []
    vendor_ids = {str(v.get("id") or "") for v in vendors}
    for item in items[:800]:
        issues = []
        if not item_name(item):
            issues.append("missing name")
        if not (item.get("supplierId") or item.get("vendorId") or item.get("vendorName")):
            issues.append("missing vendor")
        elif str(item.get("supplierId") or item.get("vendorId") or "") and str(item.get("supplierId") or item.get("vendorId") or "") not in vendor_ids:
            issues.append("vendor link may be broken")
        if num(item.get("parLevel"), -1) < 0:
            issues.append("negative par")
        if num(item.get("currentStock"), -1) < 0:
            issues.append("negative stock")
        if not item.get("packSize"):
            issues.append("missing pack size")
        if issues:
            rows.append({"severity": "medium", "area": "Inventory", "recordId": item.get("id") or "", "title": item_name(item) or "Inventory item", "issues": issues, "recommendation": "Clean up item setup so AI ordering and reports are more accurate."})
    seen_user_email = Counter(clean(u.get("email")) for u in (payload.get("users") or []) if u.get("email"))
    for email, count in seen_user_email.items():
        if count > 1:
            rows.append({"severity": "high", "area": "Staff", "title": email, "issues": ["duplicate staff email"], "recommendation": "Merge or deactivate duplicate user profiles."})
    for dep in (payload.get("menuDependencies") or [])[:1200]:
        if not (dep.get("inventoryItemId") or dep.get("inventoryItemName") or dep.get("ingredientName")):
            rows.append({"severity": "low", "area": "Menu Intelligence", "recordId": dep.get("id") or "", "title": dep.get("menuItemName") or dep.get("recipeName") or "Menu link", "issues": ["missing inventory ingredient link"], "recommendation": "Reconnect this dependency so 86 alerts and ordering impact work."})
    for rem in (payload.get("reminders") or [])[:500]:
        if not (rem.get("title") or rem.get("text")):
            rows.append({"severity": "low", "area": "Reminders", "recordId": rem.get("id") or "", "title": "Untitled reminder", "issues": ["missing title"], "recommendation": "Archive or repair the blank reminder."})
    rows.sort(key=lambda r: ({"high": 0, "medium": 1, "low": 2}.get(r.get("severity"), 3), r.get("area", "")))
    return rows[:120]


def analyze_backups(backups: List[Dict[str, Any]], backup_status: Dict[str, Any], current: str) -> List[Dict[str, Any]]:
    checks = []
    last = date_key(backup_status.get("lastSuccessfulBackupAt") or backup_status.get("lastBackupAt") or backup_status.get("updatedAt"))
    if last:
        age = days_between(last, current)
        checks.append({"status": "ok" if age <= 2 else "attention", "title": "Last successful backup age", "detail": f"Last backup appears to be {age} day(s) old.", "recommendation": "Run Backup Now before risky releases." if age > 2 else "Backup age looks normal."})
    else:
        checks.append({"status": "attention", "title": "Backup status missing", "detail": "No last successful backup timestamp was provided to the Python scan.", "recommendation": "Open System Administrator > Backup Center and run or verify a backup."})
    failed = [b for b in backups or [] if clean(b.get("status") or b.get("integrityStatus")) in ("failed", "error", "bad")]
    if failed:
        checks.append({"status": "attention", "title": "Failed backup records", "detail": f"{len(failed)} backup record(s) look failed or unhealthy.", "recommendation": "Do not restore from failed backups. Run a fresh backup and verify integrity."})
    return checks


def build_reports(payload: Dict[str, Any], price_watch: List[Dict[str, Any]], waste: List[Dict[str, Any]], pars: List[Dict[str, Any]], menu_costs: List[Dict[str, Any]], labor: List[Dict[str, Any]], health: List[Dict[str, Any]]) -> Dict[str, str]:
    lines = ["86 Chaos Python Operations Report", f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}", ""]
    sections = [
        ("Price Watch", [p.get("summary") for p in price_watch[:12]]),
        ("Par Recommendations", [f"{p.get('itemName')}: {p.get('direction')} par from {p.get('currentPar')} to {p.get('suggestedPar')}" for p in pars[:12]]),
        ("Waste Patterns", [f"{w.get('itemName')}: {w.get('recentWaste')} wasted, top reason {w.get('topReason')}" for w in waste[:12]]),
        ("Menu Costing", [m.get("summary") for m in menu_costs[:12]]),
        ("Labor / Schedule Warnings", [f"{l.get('title')}: {l.get('detail')}" for l in labor[:12]]),
        ("Data Health", [f"{h.get('area')}: {h.get('title')} - {', '.join(h.get('issues') or [])}" for h in health[:12]]),
    ]
    for heading, items in sections:
        lines.append(heading)
        if items:
            lines.extend(f"- {x}" for x in items if x)
        else:
            lines.append("- No major findings.")
        lines.append("")
    csv_rows = [["area", "severity", "title", "detail", "recommendation"]]
    for p in price_watch:
        csv_rows.append(["Price", p.get("severity", "medium"), p.get("itemName", ""), p.get("summary", ""), "Review vendor pricing and invoice catalog."])
    for w in waste:
        csv_rows.append(["Waste", w.get("severity", "medium"), w.get("itemName", ""), f"Recent waste {w.get('recentWaste')}", w.get("suggestion", "")])
    for p in pars:
        csv_rows.append(["Par", "medium", p.get("itemName", ""), f"{p.get('direction')} par from {p.get('currentPar')} to {p.get('suggestedPar')}", p.get("reason", "")])
    for m in menu_costs:
        csv_rows.append(["Menu Cost", m.get("severity", "low"), m.get("recipeName", ""), m.get("summary", ""), "Verify recipe quantities and menu price."])
    for l in labor:
        csv_rows.append(["Labor", l.get("severity", "medium"), l.get("title", ""), l.get("detail", ""), l.get("recommendation", "")])
    for h in health:
        csv_rows.append(["Data Health", h.get("severity", "medium"), h.get("title", ""), "; ".join(h.get("issues") or []), h.get("recommendation", "")])
    csv = "\n".join(",".join('"' + str(col).replace('"', '""') + '"' for col in row) for row in csv_rows)
    return {"text": "\n".join(lines).strip(), "csv": csv}


def analyze(payload: Dict[str, Any]) -> Dict[str, Any]:
    current = date_key(payload.get("currentDate")) or date.today().isoformat()
    days_ahead = max(3, min(30, int(num(payload.get("daysAhead"), 7))))
    items = payload.get("inventoryItems") or []
    invoices = payload.get("invoices") or []
    waste_logs = payload.get("wasteLogs") or []
    recipes = payload.get("recipes") or []
    deps = payload.get("menuDependencies") or []
    users = payload.get("users") or []
    shifts = payload.get("shifts") or []
    punches = payload.get("timePunches") or []
    availability = payload.get("availabilityRecords") or []
    time_off = payload.get("timeOffRequests") or []
    backups = payload.get("backups") or []
    backup_status = payload.get("backupStatus") or {}

    price_watch, invoice_anomalies = analyze_price_watch(items, invoices)
    waste, pars = analyze_waste_and_par(items, waste_logs, invoices, current, days_ahead)
    menu_costs = analyze_menu_costing(recipes, items, invoices, deps)
    labor = analyze_labor(users, shifts, punches, availability, time_off, current)
    health = analyze_data_health(payload)
    backup_checks = analyze_backups(backups, backup_status, current)
    reports = build_reports(payload, price_watch, waste, pars, menu_costs, labor, health)

    manager_brief = []
    if price_watch:
        manager_brief.append(f"{len(price_watch)} price warning(s), led by {price_watch[0].get('itemName')} at {abs(price_watch[0].get('changePct', 0)):g}% change.")
    if pars:
        manager_brief.append(f"{len(pars)} par recommendation(s) need review before ordering changes.")
    if waste:
        manager_brief.append(f"{len(waste)} waste pattern(s) may be affecting food cost.")
    if menu_costs:
        high_menu = [m for m in menu_costs if m.get("severity") in ("high", "medium")]
        if high_menu:
            manager_brief.append(f"{len(high_menu)} recipe/menu cost item(s) need price or ingredient setup review.")
    if labor:
        manager_brief.append(f"{len(labor)} labor/schedule warning(s) need manager review.")
    if health:
        manager_brief.append(f"{len(health)} data health issue(s) could reduce AI accuracy.")
    if any(c.get("status") == "attention" for c in backup_checks):
        manager_brief.append("Backup status needs attention before risky releases.")
    if not manager_brief:
        manager_brief.append("Python Ops Intelligence found no major risk queues in the provided data window.")

    return {
        "ok": True,
        "engine": "python-ops-intelligence",
        "version": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds") + "Z",
        "currentDate": current,
        "summary": {
            "priceWarningCount": len(price_watch),
            "invoiceAnomalyCount": len(invoice_anomalies),
            "parRecommendationCount": len(pars),
            "wasteInsightCount": len(waste),
            "menuCostCount": len(menu_costs),
            "laborWarningCount": len(labor),
            "dataHealthCount": len(health),
            "backupCheckCount": len(backup_checks),
        },
        "managerBrief": manager_brief,
        "priceWatch": price_watch,
        "invoiceAnomalies": invoice_anomalies,
        "parRecommendations": pars,
        "wastePatterns": waste,
        "menuCosting": menu_costs,
        "laborScheduleWarnings": labor,
        "dataHealth": health,
        "backupChecks": backup_checks,
        "reports": reports,
    }


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        print(json.dumps(analyze(payload), separators=(",", ":")))
    except Exception as exc:
        print(json.dumps({"ok": False, "engine": "python-ops-intelligence", "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
