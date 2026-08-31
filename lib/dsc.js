const DSC_STUDENT_URL =
  "https://www.dsc.du.ac.in/notifications/category/students/list/?eventDisplay=past";

export async function getDSCStudentNotices() {
  const response = await fetch(DSC_STUDENT_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`DSC website returned ${response.status}`);
  }

  const html = await response.text();

  const notices = [];

  /*
   * The DSC notification archive uses headings for
   * individual notification titles.
   */
  const headingRegex =
    /<h3[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi;

  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const url = match[1];

    const title = match[2]
      .replace(/<[^>]*>/g, "")
      .replace(/&#038;/g, "&")
      .replace(/&#8217;/g, "'")
      .replace(/&#8211;/g, "–")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (!title || !url) {
      continue;
    }

    const fullUrl = url.startsWith("http")
      ? url
      : new URL(url, DSC_STUDENT_URL).href;

    notices.push({
      source: "Dyal Singh College",
      category: "Student",
      title,
      url: fullUrl
    });
  }

  return notices;
}
