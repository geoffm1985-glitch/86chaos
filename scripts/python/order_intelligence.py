#!/usr/bin/env python3
"""86 Chaos Python order intelligence engine.

Standard-library only so it can run in Vercel without Python package installs.
Reads a JSON payload from stdin and writes a JSON analysis to stdout.
"""
import json
import math
import re
import statistics
import sys
from datetime import datetime, timedelta, date, timezone
from typing import Any, Dict, List, Tuple

DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DAY_MS = 86400


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())).strip()


def singular(value: Any) -> str:
    text = clean(value)
    words = []
    for token in text.split():
        if len(token) > 4 and token.endswith("ies"):
            token = token[:-3] + "y"
        elif len(token) > 4 and token.endswith("es"):
            token = token[:-2]
        elif len(token) > 4 and token.endswith("s"):
            token = token[:-1]
        words.append(token)
    return " ".join(words)


def tokens(value: Any) -> List[str]:
    return [w for w in singular(value).split() if len(w) > 2]


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


def parse_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    try:
        number = re.sub(r"[^0-9.\-]", "", str(value or ""))
        return float(number) if number not in ("", "-", ".") else default
    except Exception:
        return default


def item_name(item: Dict[str, Any]) -> str:
    return str(item.get("name") or item.get("itemName") or item.get("title") or item.get("text") or "")


def line_text(row: Dict[str, Any]) -> str:
    return " ".join(str(row.get(k) or "") for k in ("itemName", "name", "description", "productCode", "sku", "pfgCode"))


def to_date_key(value: Any) -> str:
    if not value:
        return ""
    raw = str(value)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    try:
        # Keep this forgiving for ISO strings written by JS/Firebase.
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except Exception:
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").date().isoformat()
        except Exception:
            return ""


def add_days(key: str, days: int) -> str:
    base = datetime.strptime(key, "%Y-%m-%d").date()
    return (base + timedelta(days=days)).isoformat()


def days_between(start: str, end: str) -> int:
    try:
        return (datetime.strptime(end, "%Y-%m-%d").date() - datetime.strptime(start, "%Y-%m-%d").date()).days
    except Exception:
        return 0


def recent_window_rows(rows: List[Dict[str, Any]], current_date: str, days: int = 60) -> List[Dict[str, Any]]:
    start = add_days(current_date, -days)
    return [row for row in rows if row.get("date") and start <= row.get("date") <= current_date]


def invoice_rows_for_item(item: Dict[str, Any], invoices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    label = item_name(item)
    item_id = str(item.get("id") or "")
    rows: List[Dict[str, Any]] = []
    for inv in invoices or []:
        inv_date = to_date_key(inv.get("invoiceDate") or inv.get("processedAt") or inv.get("createdAt") or inv.get("date"))
        for row in inv.get("lineItems") or inv.get("rows") or []:
            matched_id = str(row.get("matchedItemId") or row.get("matchId") or row.get("itemId") or row.get("inventoryItemId") or "")
            if (item_id and matched_id == item_id) or text_score(label, line_text(row)) >= 55:
                qty = max(1.0, parse_float(row.get("quantity") or row.get("qty"), 1.0))
                unit_price = parse_float(row.get("unitPrice"), 0.0)
                if unit_price <= 0:
                    unit_price = parse_float(row.get("total") or row.get("lineTotal"), 0.0) / qty
                rows.append({"date": inv_date, "qty": qty, "unitPrice": unit_price, "raw": row})
    return sorted(rows, key=lambda r: r.get("date") or "", reverse=True)


def waste_for_item(item: Dict[str, Any], waste_logs: List[Dict[str, Any]], current_date: str, days: int = 30) -> Tuple[float, int]:
    start = add_days(current_date, -days)
    item_id = str(item.get("id") or "")
    total = 0.0
    count = 0
    for log in waste_logs or []:
        key = to_date_key(log.get("date") or log.get("timestamp") or log.get("createdAt"))
        if not key or key < start or key > current_date:
            continue
        if (item_id and str(log.get("itemId") or "") == item_id) or text_score(item_name(item), log.get("itemName") or "") >= 55:
            total += parse_float(log.get("stockDeducted"), parse_float(log.get("qty"), 0.0))
            count += 1
    return total, count


def prep_demand_for_item(item: Dict[str, Any], prep_items: List[Dict[str, Any]], current_date: str, days_ahead: int) -> float:
    end = add_days(current_date, days_ahead)
    total = 0.0
    for prep in prep_items or []:
        key = to_date_key(prep.get("date") or prep.get("prepDate") or prep.get("dueDate") or current_date)
        if key and (key < current_date or key > end):
            continue
        if text_score(item_name(item), prep.get("text") or prep.get("title") or prep.get("name") or "") >= 35:
            total += max(1.0, parse_float(prep.get("qty"), 1.0))
    return total


def dependency_count_for_item(item: Dict[str, Any], deps: List[Dict[str, Any]]) -> int:
    label = item_name(item)
    item_id = str(item.get("id") or "")
    seen = set()
    for dep in deps or []:
        status = clean(dep.get("status") or dep.get("reviewStatus") or dep.get("approvalStatus") or "approved")
        if status and status not in ("approved", "active", "linked", "verified"):
            continue
        dep_id = str(dep.get("inventoryItemId") or dep.get("inventoryId") or dep.get("itemId") or "")
        dep_label = dep.get("inventoryItemName") or dep.get("ingredientName") or dep.get("ingredient") or dep.get("sourceName") or ""
        if (item_id and dep_id == item_id) or text_score(label, dep_label) >= 40:
            seen.add(dep.get("menuItemName") or dep.get("recipeName") or dep.get("menuItemId") or dep.get("id") or dep_label)
    return len(seen)


def event_signals_for_item(item: Dict[str, Any], events: List[Dict[str, Any]], deps: List[Dict[str, Any]], current_date: str, days_ahead: int) -> List[Dict[str, Any]]:
    end = add_days(current_date, days_ahead)
    label = item_name(item)
    dep_names = []
    item_id = str(item.get("id") or "")
    for dep in deps or []:
        dep_id = str(dep.get("inventoryItemId") or dep.get("inventoryId") or dep.get("itemId") or "")
        dep_label = dep.get("inventoryItemName") or dep.get("ingredientName") or dep.get("ingredient") or ""
        if (item_id and dep_id == item_id) or text_score(label, dep_label) >= 40:
            name = dep.get("menuItemName") or dep.get("recipeName") or ""
            if name:
                dep_names.append(name)
    matches = []
    for ev in events or []:
        key = to_date_key(ev.get("date") or ev.get("startDate"))
        if not key or key < current_date or key > end:
            continue
        haystack = " ".join(str(ev.get(k) or "") for k in ("title", "name", "notes", "description", "menu", "menuNotes", "type", "category")) + " " + " ".join(dep_names)
        score = max([text_score(label, haystack)] + [text_score(dep, haystack) for dep in dep_names] + [0])
        if score >= 18:
            matches.append({"eventId": ev.get("id") or "", "title": ev.get("title") or ev.get("name") or "Event", "date": key, "score": score})
    return sorted(matches, key=lambda m: (-m["score"], m["date"]))[:5]


def day_of_week_usage(rows: List[Dict[str, Any]]) -> Dict[str, float]:
    buckets = {day: [] for day in DAY_NAMES}
    for row in rows:
        key = row.get("date")
        if not key:
            continue
        try:
            day = DAY_NAMES[datetime.strptime(key, "%Y-%m-%d").date().weekday()]
            buckets[day].append(float(row.get("qty") or 0))
        except Exception:
            continue
    return {day: round(statistics.mean(vals), 2) for day, vals in buckets.items() if vals}


def confidence_score(row: Dict[str, Any]) -> int:
    score = 30
    if row.get("invoiceSamples", 0) >= 3:
        score += 25
    elif row.get("invoiceSamples", 0) >= 1:
        score += 12
    if row.get("menuImpactCount", 0) > 0:
        score += 15
    if row.get("eventSignals"):
        score += 15
    if row.get("prepDemand", 0) > 0:
        score += 10
    if row.get("par", 0) > 0:
        score += 10
    if row.get("recentWaste", 0) > 0:
        score -= min(12, int(row.get("recentWaste", 0) * 2))
    return max(10, min(98, score))


def analyze(payload: Dict[str, Any]) -> Dict[str, Any]:
    current_date = to_date_key(payload.get("currentDate")) or date.today().isoformat()
    days_ahead = int(parse_float(payload.get("daysAhead"), 7))
    event_days_ahead = int(parse_float(payload.get("eventDaysAhead"), 21))
    items = payload.get("inventoryItems") or []
    vendors = {str(v.get("id") or ""): v for v in (payload.get("vendors") or [])}
    waste_logs = payload.get("wasteLogs") or []
    invoices = payload.get("invoices") or []
    events = payload.get("events") or []
    prep_items = payload.get("prepItems") or []
    deps = payload.get("menuDependencies") or []

    forecasts = []
    price_watch = []
    par_changes = []
    waste_insights = []
    event_supply = []
    prep_forecast = []

    for item in items[:600]:
        par = parse_float(item.get("parLevel"), 0.0)
        stock = parse_float(item.get("currentStock"), 0.0)
        pending = parse_float(item.get("pendingQty"), 0.0)
        invoice_rows = invoice_rows_for_item(item, invoices)
        recent_rows = recent_window_rows(invoice_rows, current_date, 60)
        recent_qtys = [r["qty"] for r in recent_rows if r.get("qty", 0) > 0]
        avg_order_qty = round(statistics.mean(recent_qtys), 2) if recent_qtys else 0.0
        median_order_qty = round(statistics.median(recent_qtys), 2) if recent_qtys else 0.0
        weekly_velocity = round((sum(recent_qtys) / max(1, min(60, max(7, days_between(recent_rows[-1]["date"], current_date) if recent_rows else 7)))) * 7, 2) if recent_qtys else 0.0
        waste_total, waste_count = waste_for_item(item, waste_logs, current_date, 30)
        prep_demand = prep_demand_for_item(item, prep_items, current_date, days_ahead)
        menu_impact = dependency_count_for_item(item, deps)
        event_signals = event_signals_for_item(item, events, deps, current_date, event_days_ahead)
        event_boost = min(3.0, max(0.0, sum(m["score"] for m in event_signals[:2]) / 85.0))
        prep_boost = 1.0 if prep_demand >= 4 else (0.5 if prep_demand > 0 else 0.0)
        waste_adjustment = -1.0 if waste_total >= max(2.0, par * 0.5) else 0.0
        deficit = max(0.0, par - stock - pending)
        velocity_boost = max(0.0, weekly_velocity - pending) if par <= 0 else 0.0
        suggested = max(0.0, math.ceil(max(deficit, velocity_boost) + event_boost + prep_boost + waste_adjustment))
        risk_score = (50 if deficit > 0 else 0) + min(30, menu_impact * 6) + min(25, len(event_signals) * 10) + min(18, prep_demand * 3) + min(15, weekly_velocity * 2) - min(16, waste_total * 2)
        priority = "critical" if risk_score >= 90 else "high" if risk_score >= 60 else "medium" if risk_score >= 30 else "low"
        reasons = []
        if deficit > 0:
            reasons.append(f"Below par by {round(deficit, 2):g}")
        if weekly_velocity > 0:
            reasons.append(f"Invoice velocity about {weekly_velocity:g}/week")
        if event_signals:
            reasons.append(f"Event signal: {event_signals[0]['title']}")
        if prep_demand > 0:
            reasons.append(f"Prep demand signal {prep_demand:g}")
        if menu_impact > 0:
            reasons.append(f"Affects {menu_impact} menu item{'s' if menu_impact != 1 else ''}")
        if waste_total > 0:
            reasons.append(f"Recent waste {round(waste_total, 1):g}")

        vendor = vendors.get(str(item.get("supplierId") or item.get("vendorId") or ""), {})
        forecast = {
            "itemId": item.get("id") or "",
            "itemName": item_name(item),
            "vendorId": item.get("supplierId") or item.get("vendorId") or "",
            "vendorName": vendor.get("name") or item.get("vendorName") or "No Vendor",
            "stock": stock,
            "par": par,
            "pending": pending,
            "deficit": round(deficit, 2),
            "avgOrderQty": avg_order_qty,
            "medianOrderQty": median_order_qty,
            "weeklyVelocity": weekly_velocity,
            "dayOfWeekUsage": day_of_week_usage(recent_rows),
            "recentWaste": round(waste_total, 2),
            "wasteCount": waste_count,
            "prepDemand": prep_demand,
            "menuImpactCount": menu_impact,
            "eventSignals": event_signals,
            "suggestedQty": int(suggested),
            "priority": priority,
            "riskScore": round(risk_score, 1),
            "confidence": 0,  # filled below
            "invoiceSamples": len(invoice_rows),
            "reasons": reasons,
        }
        forecast["confidence"] = confidence_score(forecast)
        if suggested > 0 or risk_score >= 30:
            forecasts.append(forecast)
        if par > 0 and weekly_velocity > 0:
            ideal_par = max(1, math.ceil((weekly_velocity / 7.0) * max(days_ahead, 3) * 1.15))
            if abs(ideal_par - par) >= max(2, par * 0.25):
                direction = "raise" if ideal_par > par else "lower"
                par_changes.append({"itemId": forecast["itemId"], "itemName": forecast["itemName"], "currentPar": par, "suggestedPar": ideal_par, "direction": direction, "reason": f"Based on recent invoice velocity of {weekly_velocity:g}/week."})
        if waste_total >= max(2.0, par * 0.5):
            waste_insights.append({"itemId": forecast["itemId"], "itemName": forecast["itemName"], "recentWaste": round(waste_total, 2), "count": waste_count, "suggestion": "Review prep amount and par before increasing order quantity."})
        if prep_demand > 0 or event_signals:
            prep_forecast.append({"itemId": forecast["itemId"], "itemName": forecast["itemName"], "suggestedPrepCheck": f"Prep/check {forecast['itemName']}", "reason": "; ".join(reasons[:3])})
        if event_signals:
            for signal in event_signals[:2]:
                event_supply.append({"eventId": signal.get("eventId"), "eventTitle": signal.get("title"), "date": signal.get("date"), "itemId": forecast["itemId"], "itemName": forecast["itemName"], "suggestedQty": int(suggested), "reason": "; ".join(reasons[:3])})

        if len(invoice_rows) >= 2:
            latest = invoice_rows[0]
            previous = next((r for r in invoice_rows[1:] if r.get("unitPrice", 0) > 0 and r.get("date") != latest.get("date")), invoice_rows[1])
            latest_price = latest.get("unitPrice") or 0
            previous_price = previous.get("unitPrice") or 0
            if previous_price > 0 and latest_price > 0:
                change = ((latest_price - previous_price) / previous_price) * 100
                if abs(change) >= 10:
                    price_watch.append({"itemId": forecast["itemId"], "itemName": forecast["itemName"], "latestPrice": round(latest_price, 2), "previousPrice": round(previous_price, 2), "changePct": round(change, 1), "direction": "up" if change > 0 else "down", "latestDate": latest.get("date"), "previousDate": previous.get("date"), "summary": f"{forecast['itemName']} is {'up' if change > 0 else 'down'} {abs(change):.0f}% from the previous invoice price."})

    forecasts.sort(key=lambda f: (-f["riskScore"], -f["suggestedQty"], f["itemName"]))
    price_watch.sort(key=lambda p: -abs(p["changePct"]))
    par_changes.sort(key=lambda p: (p["direction"] != "raise", p["itemName"]))
    waste_insights.sort(key=lambda w: -w["recentWaste"])
    event_supply.sort(key=lambda e: (e.get("date") or "", e.get("eventTitle") or "", e.get("itemName") or ""))
    prep_forecast.sort(key=lambda p: p["itemName"])

    vendor_groups: Dict[str, Dict[str, Any]] = {}
    for f in forecasts:
        if f["suggestedQty"] <= 0:
            continue
        key = f["vendorId"] or f["vendorName"] or "No Vendor"
        bucket = vendor_groups.setdefault(key, {"vendorId": f["vendorId"], "vendorName": f["vendorName"], "items": []})
        bucket["items"].append({"itemId": f["itemId"], "itemName": f["itemName"], "qty": f["suggestedQty"], "priority": f["priority"], "confidence": f["confidence"], "reasons": f["reasons"][:4]})

    brief = []
    if forecasts:
        brief.append("Python forecast focus: " + ", ".join(f"{f['itemName']} ({f['suggestedQty']})" for f in forecasts[:3]) + ".")
    else:
        brief.append("Python forecast found no urgent order pressure in this window.")
    if event_supply:
        brief.append(f"{len({e.get('eventId') for e in event_supply if e.get('eventId')}) or len(event_supply)} event supply signal(s) need review.")
    if price_watch:
        brief.append(f"{len(price_watch)} invoice price warning(s), highest change {abs(price_watch[0]['changePct']):g}%.")
    if waste_insights:
        brief.append(f"{len(waste_insights)} waste/par insight(s) need manager review.")

    return {
        "ok": True,
        "engine": "python-order-intelligence",
        "version": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds") + "Z",
        "currentDate": current_date,
        "daysAhead": days_ahead,
        "eventDaysAhead": event_days_ahead,
        "summary": {
            "forecastCount": len(forecasts),
            "vendorDraftCount": len(vendor_groups),
            "priceWarningCount": len(price_watch),
            "parChangeCount": len(par_changes),
            "wasteInsightCount": len(waste_insights),
            "eventSupplyCount": len(event_supply),
            "prepForecastCount": len(prep_forecast),
        },
        "managerBrief": brief,
        "orderForecasts": forecasts[:80],
        "vendorDrafts": list(vendor_groups.values()),
        "priceTrends": price_watch[:40],
        "parRecommendations": par_changes[:40],
        "wasteInsights": waste_insights[:40],
        "eventSupplyPlan": event_supply[:80],
        "prepForecast": prep_forecast[:40],
    }


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw or "{}")
        result = analyze(payload)
        print(json.dumps(result, separators=(",", ":")))
    except Exception as exc:
        print(json.dumps({"ok": False, "engine": "python-order-intelligence", "error": str(exc)}), file=sys.stdout)
        sys.exit(1)


if __name__ == "__main__":
    main()
