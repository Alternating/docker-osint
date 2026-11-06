import { getApiKey } from "@/lib/settings";

const UA = "Suron-OSINT/0.1 (self-hosted)";

export interface PersonCandidate {
  name: string;
  age: number | null;
  addresses: string[];
  phones: string[];
  emails: string[];
  relatives: string[];
  locationMatch: boolean;
}

export interface EndatoResult {
  candidates: PersonCandidate[];
  locationFilter: string | null;
}

export async function endatoPersonSearch(
  name: string,
  location?: string
): Promise<EndatoResult | null> {
  // Returns null when no key configured. Throws on API error.
  const key = getApiKey("endato");
  if (!key) return null;

  const idx = key.indexOf(":");
  if (idx < 1 || idx === key.length - 1) {
    throw new Error("Endato credential must be AccessProfileName:AccessProfilePassword");
  }
  const apName = key.slice(0, idx);
  const apPassword = key.slice(idx + 1);

  // First token = FirstName, last = LastName, middle = the rest. A single token
  // is treated as a surname (the primary index), and empty name fields are
  // omitted rather than sent blank (Enformion rejects empty LastName).
  const parts = name.trim().split(/\s+/).filter(Boolean);
  let firstName = "";
  let lastName = "";
  let middleName: string | undefined;
  if (parts.length === 1) {
    lastName = parts[0];
  } else if (parts.length > 1) {
    firstName = parts[0];
    lastName = parts[parts.length - 1];
    middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : undefined;
  }

  const loc = location?.trim();
  const body: Record<string, unknown> = { Page: 1, ResultsPerPage: 20 };
  if (firstName) body.FirstName = firstName;
  if (lastName) body.LastName = lastName;
  if (middleName) body.MiddleName = middleName;
  // A supplied location narrows the search server-side (City, ST) so common
  // names don't return a nationwide pile.
  if (loc) body.Addresses = [{ AddressLine2: loc }];

  const res = await fetch("https://devapi.enformion.com/PersonSearch", {
    method: "POST",
    headers: {
      "galaxy-ap-name": apName,
      "galaxy-ap-password": apPassword,
      "galaxy-search-type": "Person",
      "Content-Type": "application/json",
      Accept: "application/json",
      "user-agent": UA,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Endato rejected the credentials");
  }
  if (!res.ok) throw new Error(`Endato responded ${res.status}`);

  const data = (await res.json()) as Record<string, unknown>;

  // The multi-candidate wrapper key isn't fully documented, so collect
  // defensively from several possible shapes (array under
  // persons/Persons/results/Results, or a single flat person object).
  let rawPeople: Array<Record<string, unknown>> = [];
  for (const k of ["persons", "Persons", "results", "Results"]) {
    if (Array.isArray(data[k])) {
      rawPeople = data[k] as Array<Record<string, unknown>>;
      break;
    }
  }
  if (rawPeople.length === 0 && (data.Name || data.FullName)) {
    rawPeople = [data];
  }

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const arr = (v: unknown): Array<Record<string, unknown>> =>
    Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];

  // Tokenize the location once; match on whole address tokens (not substrings,
  // so a state code like "NY" can't match inside "Sunnyvale").
  const locTokens = loc
    ? loc.split(/[^a-z0-9]+/i).filter(Boolean).map((t) => t.toLowerCase())
    : [];

  const candidates: PersonCandidate[] = rawPeople.slice(0, 20).map((p) => {
    const nameObj = (p.Name ?? {}) as Record<string, unknown>;
    const fullName =
      str(p.FullName) ||
      [str(nameObj.FirstName), str(nameObj.MiddleName), str(nameObj.LastName)]
        .filter(Boolean)
        .join(" ");
    const addresses = arr(p.Addresses)
      .map(
        (a) =>
          str(a.FullAddress) ||
          [str(a.City), str(a.State), str(a.Zip)].filter(Boolean).join(", ")
      )
      .filter(Boolean);
    const phones = arr(p.PhoneNumbers)
      .map((x) => str(x.PhoneNumber))
      .filter(Boolean);
    const emails = arr(p.EmailAddresses)
      .map((x) => str(x.EmailAddress))
      .filter(Boolean);
    const relatives = [...arr(p.RelativesSummary), ...arr(p.AssociatesSummary)]
      .map((r) => [str(r.FirstName), str(r.LastName)].filter(Boolean).join(" "))
      .filter(Boolean);
    const ageVal = typeof p.Age === "number" ? p.Age : null;

    const locationMatch =
      locTokens.length > 0 &&
      addresses.some((a) => {
        const addrTokens = a.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        return locTokens.every((t) => addrTokens.includes(t));
      });

    return {
      name: fullName || "(unknown)",
      age: ageVal,
      addresses,
      phones,
      emails,
      relatives,
      locationMatch,
    };
  });

  // When a location was given, surface matches first.
  if (loc) candidates.sort((a, b) => Number(b.locationMatch) - Number(a.locationMatch));

  return { candidates, locationFilter: loc ?? null };
}
