const DSC_URL = "https://www.dsc.du.ac.in/notifications/";

export async function getDSCStudentNotices() {
  const response = await fetch(DSC_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`DSC website returned ${response.status}`);
  }

  const html = await response.text();

  const notices = [];

  // Extract notification titles and links
  const regex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1];

    const title = match[2]
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (
      title.length > 10 &&
      !title.toLowerCase().includes("find out more") &&
      !title.toLowerCase().includes("previous") &&
      !title.toLowerCase().includes("next")
    ) {
      const fullUrl = url.startsWith("http")
        ? url
        : new URL(url, DSC_URL).href;

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
