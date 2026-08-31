
const DSC_STUDENT_URL =
  "https://www.dsc.du.ac.in/notifications/category/students/list/?eventDisplay=past";

const DSC_TEACHING_URL =
  "https://www.dsc.du.ac.in/notifications/category/teaching/list/?eventDisplay=past";


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
 * Extract a date from the HTML surrounding a notice.
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

    /\b(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|Aug|September|Sep|Sept|October|Oct|November|Nov|December|Dec)\s+\d{1,2},\s+\d{4}\b/i,

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


async function fetchDSCNotices(pageUrl, category) {
  const response = await fetch(pageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });


  if (!response.ok) {
    throw new Error(
      `DSC ${category} website returned ${response.status}`
    );
  }


  const html = await response.text();

  const notices = [];


  /*
   * Find each notice heading.
   */
  const headingRegex =
    /<h3[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi;


  let match;


  while ((match = headingRegex.exec(html)) !== null) {

    const url = match[1];

    const title =
      cleanTitle(match[2]);


    if (!title || !url) {
      continue;
    }


    const fullUrl =
      url.startsWith("http")
        ? url
        : new URL(url, pageUrl).href;


    /*
     * Look around the current heading for
     * the notice date.
     *
     * We inspect the HTML after the heading
     * until the next heading.
     */
    const startIndex =
      match.index;

    const nextHeading =
      html.indexOf(
        "<h3",
        startIndex + match[0].length
      );


    const endIndex =
      nextHeading === -1
        ? Math.min(
            html.length,
            startIndex + 5000
          )
        : nextHeading;


    const surroundingHtml =
      html.substring(
        startIndex,
        endIndex
      );


    const notice_date =
      extractNoticeDate(
        surroundingHtml
      );


    notices.push({
      source: "Dyal Singh College",

      category,

      title,

      url: fullUrl,

      notice_date
    });
  }


  return notices;
}


export async function getDSCStudentNotices() {
  return fetchDSCNotices(
    DSC_STUDENT_URL,
    "Student"
  );
}


export async function getDSCTeachingNotices() {
  return fetchDSCNotices(
    DSC_TEACHING_URL,
    "Teaching"
  );
}
