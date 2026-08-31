const DU_NOTIFICATIONS_URL =
  "https://www.du.ac.in/?page=notifications";


function cleanTitle(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&#038;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}


/*
 * Extract a date from the HTML around a notice.
 */
function extractNoticeDate(block) {
  const text = String(block || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();


  const datePatterns = [
    /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\b/,

    /\b\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4}\b/i,

    /\b(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2},\s+\d{4}\b/i,

    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December),?\s+\d{4}\b/i
  ];


  for (const pattern of datePatterns) {
    const match = text.match(pattern);

    if (match) {
      return match[0];
    }
  }


  return null;
}


export async function getDUNotices() {

  const response = await fetch(
    DU_NOTIFICATIONS_URL,
    {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    }
  );


  if (!response.ok) {
    throw new Error(
      `Delhi University website returned ${response.status}`
    );
  }


  const html =
    await response.text();


  const notices = [];


  /*
   * Locate DU Spotlight section.
   */
  const spotlightMatch =
    html.match(
      /Spotlight([\s\S]*?)(?:Can't find what you're looking for|Ready to Start|View Knowledgebase)/i
    );


  if (!spotlightMatch) {
    throw new Error(
      "DU Spotlight section could not be found"
    );
  }


  const spotlight =
    spotlightMatch[1];


  /*
   * Extract links.
   */
  const linkRegex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


  let match;


  while (
    (match = linkRegex.exec(spotlight)) !== null
  ) {

    const url =
      match[1];


    const title =
      cleanTitle(match[2]);


    if (!title || !url) {
      continue;
    }


    /*
     * Ignore navigation links.
     */
    if (
      title.length < 8 ||
      title
        .toLowerCase()
        .includes("view knowledgebase") ||
      title
        .toLowerCase()
        .includes("previous page") ||
      title
        .toLowerCase()
        .includes("next page")
    ) {
      continue;
    }


    const fullUrl =
      url.startsWith("http")
        ? url
        : new URL(
            url,
            DU_NOTIFICATIONS_URL
          ).href;


    /*
     * Only official DU links.
     */
    if (
      !fullUrl.includes("du.ac.in")
    ) {
      continue;
    }


    /*
     * Inspect the HTML around this
     * particular notice to find its date.
     */
    const startIndex =
      match.index;


    const nextLink =
      spotlight.indexOf(
        "<a",
        startIndex + match[0].length
      );


    const endIndex =
      nextLink === -1
        ? Math.min(
            spotlight.length,
            startIndex + 5000
          )
        : nextLink;


    const surroundingHtml =
      spotlight.substring(
        startIndex,
        endIndex
      );


    const notice_date =
      extractNoticeDate(
        surroundingHtml
      );


    notices.push({

      source:
        "University of Delhi",

      category:
        "Official Notification",

      title,

      url:
        fullUrl,

      notice_date

    });
  }


  /*
   * Remove duplicates.
   */
  const unique = [];

  const seen =
    new Set();


  for (
    const notice
    of notices
  ) {

    const key =
      `${notice.title}|${notice.url}`;


    if (
      !seen.has(key)
    ) {

      seen.add(key);

      unique.push(notice);
    }
  }


  return unique;
}
