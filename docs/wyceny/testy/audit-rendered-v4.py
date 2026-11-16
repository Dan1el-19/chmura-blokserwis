#!/usr/bin/env python3
"""Audit PDFs downloaded by the opt-in API/worker integration test.

Requires pdfplumber. The argument is QUOTES_TEST_FIXTURE_OUTPUT; this checks
the actual PDFs, not the DOM or the inputs passed to the renderer.
"""
import json
import re
import sys
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import pdfplumber


def compact(value):
    return re.sub(r"\s+", "", value)


def money(value):
    return format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), ",.2f").replace(",", " ").replace(".", ",") + " zł"


folder = Path(sys.argv[1])
fixtures = json.loads((folder / "fixtures.json").read_text())
assert len(fixtures) == 16
for fixture in fixtures:
    path = folder / (fixture["name"] + ".pdf")
    with pdfplumber.open(path) as pdf:
        assert pdf.pages, path
        items, scopes, pages_text = [], [], []
        last_page_fill = None
        for number, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            pages_text.append(text)
            assert f"{number} / {len(pdf.pages)}" in text, (path, number, "page number")
            assert "Testowa firma" in text and "test@example.pl" in text, (path, number, "footer")
            words = page.extract_words()
            for index, first in enumerate(words):
                for second in words[index + 1:]:
                    overlap_x = min(first["x1"], second["x1"]) - max(first["x0"], second["x0"])
                    overlap_y = min(first["bottom"], second["bottom"]) - max(first["top"], second["top"])
                    assert overlap_x <= 1 or overlap_y <= 2, (path, number, "overlapping words", first["text"], second["text"])
            footer_words = [word for word in words if word["top"] > page.height - 75]
            labels = [word["text"] for word in footer_words]
            page_label = [str(number), "/", str(len(pdf.pages))]
            position = next((i for i in range(len(labels) - 2) if labels[i:i + 3] == page_label), None)
            assert position is not None, (path, number, "footer page label")
            midpoint = (footer_words[position]["x0"] + footer_words[position + 2]["x1"]) / 2
            assert abs(midpoint - page.width / 2) < 2, (path, number, "page label center", midpoint)
            if number == len(pdf.pages):
                body_top = 17 * 72 / 25.4
                body_height = 249 * 72 / 25.4
                body_chars = [char for char in page.chars if not char["text"].isspace() and char["bottom"] < body_top + body_height]
                assert body_chars, (path, "empty last page")
                # The bottom of the last visible glyph is a conservative lower
                # bound: the measured layout block may extend below the glyph.
                last_page_fill = (max(char["bottom"] for char in body_chars) - body_top) / body_height
                assert last_page_fill >= 0.4, (path, "last page fill", last_page_fill)
            for char in page.chars:
                if not char["text"].isspace():
                    assert 50 <= char["x0"] and char["x1"] <= page.width - 50, (path, number, char)
                    assert 40 <= char["top"] and char["bottom"] <= page.height - 15, (path, number, char)
                    assert char["size"] >= 6.4, (path, number, "font size", char)
                size = round(char["size"], 1)
                if char["x0"] < 340 and size in (9.0, 7.5):
                    items.append(char["text"])
                if size == 8.5:
                    scopes.append(char["text"])
        item_text, scope_text = compact("".join(items)), compact("".join(scopes))
        full_text = compact("".join(pages_text))
        amounts = [
            (Decimal(item["price"]) * Decimal(item["qty"])).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            for item in fixture["items"]
        ]
        for amount, count in Counter(amounts).items():
            assert full_text.count(compact(money(amount))) >= count, (path, "line amount", amount)
        assert compact(money(sum(amounts))) in full_text, (path, "total")
        item_offset = 0
        for item in fixture["items"]:
            for value in (item["name"], item["desc"]):
                needle = compact(value)
                if not needle:
                    continue
                index = item_text.find(needle, item_offset)
                assert index >= 0, (path, "item text", value[:100])
                item_offset = index + len(needle)
        scope_offset = 0
        for heading, body in fixture["scopes"]:
            assert compact(heading) in item_text, (path, "section heading", heading)
            needle = compact(body)
            index = scope_text.find(needle, scope_offset)
            assert index >= 0, (path, "section body", body[:100])
            scope_offset = index + len(needle)
    print(f"{path.name}: {len(pdf.pages)} pages, last page at least {last_page_fill:.1%} filled OK")
