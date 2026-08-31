const DSC_STUDENT_URL =
  "https://www.dsc.du.ac.in/notifications/category/students/list/?eventDisplay=past";

const DSC_TEACHING_URL =
  "https://www.dsc.du.ac.in/notifications/category/teaching/list/?eventDisplay=past";

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

  const headingRegex =
    /<h3[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi;

  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const url = match[1];
    const title = cleanTitle(match[2]);

    if (!title || !url) {
      continue;
    }

    const fullUrl = url.startsWith("http")
      ? url
      : new URL(url, pageUrl).href;

    notices.push({
      source: "Dyal Singh College",
      category,
      title,
      url: fullUrl
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
