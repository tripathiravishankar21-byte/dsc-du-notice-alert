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
   * DU's Notifications page contains the
   * notification entries as links.
   *
   * We start from the Notifications section,
   * rather than scraping the whole website.
   */

  const notificationSection =
    html.split(/<h[1-6][^>]*>\s*Notifications\s*<\/h[1-6]>/i)[1] || html;

  const linkRegex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = linkRegex.exec(notificationSection)) !== null) {
    const url = match[1];
    const title = cleanTitle(match[2]);

    if (!title || !url) {
      continue;
    }

    // Ignore navigation / non-notification links
    if (
      title.length < 15 ||
      title.toLowerCase().includes("share this") ||
      title.toLowerCase().includes("previous") ||
      title.toLowerCase().includes("next")
    ) {
      continue;
    }

    const fullUrl = url.startsWith("http")
      ? url
      : new URL(url, DU_NOTIFICATIONS_URL).href;

    // Only keep DU official links
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

  // Remove duplicate links
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
