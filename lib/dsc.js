const DSC_STUDENT_URL = "https://www.dsc.du.ac.in/notices/students";

export async function getDSCStudentNotices() {
  const response = await fetch(DSC_STUDENT_URL);

  if (!response.ok) {
    throw new Error(`DSC website returned ${response.status}`);
  }

  const html = await response.text();

  const notices = [];

  const linkRegex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const rawTitle = match[2];

    const title = rawTitle
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (
      title &&
      title.length > 10 &&
      !title.toLowerCase().includes("find out more")
    ) {
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
  }

  return notices;
}
