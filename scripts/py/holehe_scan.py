#!/usr/bin/env python3
"""Run all holehe modules against one email and print a single JSON object."""
import sys
import json
import contextlib
import trio
import httpx
from holehe.core import import_submodules, get_functions, is_email


def normalize(mod, result):
    return {
        "name": str(result.get("name") or mod.__name__),
        "domain": result.get("domain"),
        "method": result.get("method"),
        "exists": result.get("exists"),
        "rateLimit": result.get("rateLimit"),
        "frequent_rate_limit": result.get("frequent_rate_limit"),
        "emailrecovery": result.get("emailrecovery"),
        "phoneNumber": result.get("phoneNumber"),
        "others": result.get("others"),
        "error": False,
    }


def error_entry(mod):
    return {
        "name": mod.__name__,
        "domain": None,
        "method": None,
        "exists": None,
        "rateLimit": False,
        "frequent_rate_limit": None,
        "emailrecovery": None,
        "phoneNumber": None,
        "others": None,
        "error": True,
    }


async def run_one(mod, email, client, out):
    # holehe modules append one dict to the list they are handed; a private
    # list per module keeps one crashing module from corrupting the rest.
    local = []
    try:
        await mod(email, client, local)
        for result in local:
            out.append(normalize(mod, result))
        if not local:
            out.append(error_entry(mod))
    except Exception:
        out.append(error_entry(mod))


async def main(email):
    async with httpx.AsyncClient(timeout=10) as client:
        modules = get_functions(import_submodules("holehe.modules"))
        out = []
        with trio.move_on_after(120):
            async with trio.open_nursery() as nursery:
                for mod in modules:
                    nursery.start_soon(run_one, mod, email, client, out)

    results = sorted(out, key=lambda r: r["name"].lower())
    found = sum(1 for r in results if r["exists"] is True)
    payload = {"email": email, "total": len(results), "found": found, "results": results}
    sys.__stdout__.write(json.dumps(payload) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 2 or not is_email(sys.argv[1]):
        sys.__stdout__.write(json.dumps({"error": "invalid email"}) + "\n")
        sys.exit(1)
    try:
        # holehe's facebook module print()s to stdout; keep stdout pure JSON.
        with contextlib.redirect_stdout(sys.stderr):
            trio.run(main, sys.argv[1])
    except Exception as e:
        sys.__stdout__.write(json.dumps({"error": str(e)}) + "\n")
        sys.exit(1)
