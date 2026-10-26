#!/usr/bin/env python3
"""Keyless phone-number intelligence via libphonenumber; prints one JSON object."""
import sys
import json
import phonenumbers
from phonenumbers import geocoder, carrier, timezone, NumberParseException
from phonenumbers.phonenumberutil import PhoneNumberFormat

TYPE_MAP = {
    0: "FIXED_LINE",
    1: "MOBILE",
    2: "FIXED_LINE_OR_MOBILE",
    3: "TOLL_FREE",
    4: "PREMIUM_RATE",
    5: "SHARED_COST",
    6: "VOIP",
    7: "PERSONAL_NUMBER",
    8: "PAGER",
    9: "UAN",
    10: "VOICEMAIL",
    99: "UNKNOWN",
}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: phone_scan.py <number> [region]"}))
        sys.exit(1)

    raw = sys.argv[1]
    region = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else "US"

    try:
        num = phonenumbers.parse(raw, region)
    except NumberParseException as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(0)

    result = {
        "input": raw,
        "valid": phonenumbers.is_valid_number(num),
        "possible": phonenumbers.is_possible_number(num),
        "e164": phonenumbers.format_number(num, PhoneNumberFormat.E164),
        "international": phonenumbers.format_number(num, PhoneNumberFormat.INTERNATIONAL),
        "national": phonenumbers.format_number(num, PhoneNumberFormat.NATIONAL),
        "country_code": num.country_code,
        "region": phonenumbers.region_code_for_number(num),
        "location": geocoder.description_for_number(num, "en"),
        "carrier": carrier.name_for_number(num, "en"),
        "timezones": list(timezone.time_zones_for_number(num)),
        "number_type": TYPE_MAP.get(phonenumbers.number_type(num), "UNKNOWN"),
    }

    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # structured error, never a traceback on stdout
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
