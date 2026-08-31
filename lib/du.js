const DU_NOTIFICATIONS_URL =
  "https://www.du.ac.in/?page=notifications";

function cleanTitle(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&#038;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getDUNotices() {
  const response = await fetch(DU_NOTIFICATIONS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Delhi University website returned ${response.status}`
    );
  }

  const html = await response.text();

  const notices = [];

  /*
   * DU's current notices are displayed inside
   * the "Spotlight" section.
   *
   * We locate that section and extract only
   * its notice links.
   */

  const spotlightMatch = html.match(
    /Spotlight([\s\S]*?)(?:Can't find what you're looking for|Ready to Start|View Knowledgebase)/i
  );

  if (!spotlightMatch) {
    throw new Error(
      "DU Spotlight section could not be found"
    );
  }

  const spotlight = spotlightMatch[1];

  /*
   * Each Spotlight item contains:
   * - a link
   * - a title
   * - posted date
   */

  const linkRegex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = linkRegex.exec(spotlight)) !== null) {
    const url = match[1];
    const title = cleanTitle(match[2]);

    if (!title || !url) {
      continue;
    }

    /*
     * Ignore navigation / empty links.
     */
    if (
      title.length < 8 ||
      title.toLowerCase().includes("view knowledgebase") ||
      title.toLowerCase().includes("previous page") ||
      title.toLowerCase().includes("next page")
    ) {
      continue;
    }

    const fullUrl = url.startsWith("http")
      ? url
      : new URL(url, DU_NOTIFICATIONS_URL).href;

    /*
     * Only accept official DU links.
     */
    if (!fullUrl.includes("du.ac.in")) {
      continue;
    }

    notices.push({
      source: "University of Delhi",
      category: "Official Notification",
      title,
      url: fullUrl
    });
  }

  /*
   * Remove duplicate notices.
   */
  const unique = [];
  const seen = new Set();

  for (const notice of notices) {
    const key = `${notice.title}|${notice.url}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(notice);
    }
  }

  return unique;
}
