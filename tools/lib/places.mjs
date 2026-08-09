/**
 * Resolving a station string to a place, and a place name to a stable key.
 *
 * Both builders and the weather fetch go through here, so a station cannot
 * resolve one way on the timeline and another way on the weather.
 *
 * Matching is whole-word and longest-match-first. A naive `includes()` made
 * "Ger" (Ger, Manche) match every station ending "(Germany)" and silently moved
 * three months of the war to Normandy. If you add a short place name, check the
 * map afterwards.
 */

export const slug = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Keys already used by the hand-authored events, so the two sets do not diverge.
const ALIAS = {
  "fort-slocum-new-york": "fort-slocum",
  "new-york-port-of-embarkation": "nype",
  "north-atlantic-crossing": "atlantic",
};

export const placeKey = (name) => ALIAS[slug(name)] ?? slug(name);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds the station resolver for a gazetteer.
 *
 * Two early-Normandy date ranges carry no place name in the station field — the
 * clerk wrote only "APO 230 France" — and resolve through `overrides` instead.
 */
export function createPlaceResolver(gaz) {
  const matchers = [...gaz.places]
    .sort((a, b) => b.match.trim().length - a.match.trim().length)
    .map((p) => ({ ...p, re: new RegExp(`\\b${esc(p.match.trim())}\\b`, "i") }));

  return (station, date) => {
    const ov = gaz.overrides.find((o) => date >= o.from && date <= o.to);
    if (ov) return gaz.places.find((p) => p.match === ov.place) ?? null;
    if (!station) return null;
    return matchers.find((p) => p.re.test(station)) ?? null;
  };
}
