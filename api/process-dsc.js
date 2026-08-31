import {
  getDSCStudentNotices,
  getDSCTeachingNotices
} from "../lib/dsc.js";

import { getDUNotices } from "../lib/du.js";


function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


function cleanUrl(url) {
  return String(url || "")
    .replace(/#new_tab$/, "")
    .trim();
}


function makeNoticeKey(notice) {
  const title = String(notice.title || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const url = cleanUrl(notice.url);

  return `${notice.source}|${notice.category}|${title}|${url}`;
}


/*
 * Classify Delhi University notices.
 */
function classifyDUNotice(title) {
  const text = String(title || "").toLowerCase();

  // Recruitment gets highest priority
  if (
    text.includes("advertisement no.") ||
    text.includes("advertisement no") ||
    text.includes("recruitment") ||
    text.includes("assistant professor") ||
    text.includes("associate professor") ||
    text.includes("post of professor")
  ) {
    return "Recruitment";
  }

  // Examination
  if (
    text.includes("examination") ||
    text.includes("exam") ||
    text.includes("result")
  ) {
    return "Examination";
  }

  // Student-related
  if (
    text.includes("admission") ||
    text.includes("cut-off") ||
    text.includes("cut off") ||
    text.includes("hostel") ||
    text.includes("undergraduate admissions") ||
    text.includes("pg program") ||
    text.includes("student") ||
    text.includes("internship") ||
    text.includes("placement") ||
    text.includes("scholarship")
  ) {
    return "Student";
  }

  // Faculty / Teaching
  if (
    text.includes("faculty research") ||
    text.includes("faculty development") ||
    text.includes("faculty of technology") ||
    text.includes("teaching centre") ||
    text.includes("teaching faculty")
  ) {
    return "Faculty / Teaching";
  }

  return "General University";
}

/*
 * Prepare DU notices with a useful category.
 */
function prepareDUNotices(notices) {
  return notices.map((notice) => ({
    source: "University of Delhi",
    category: classifyDUNotice(notice.title),
    title: String(notice.title || "").trim(),
    url: cleanUrl(notice.url)
  }));
}


/*
 * Supabase helper.
 */
async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${path}`,
    {
      ...options,

      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status}: ${text}`
    );
  }

  return text ? JSON.parse(text) : null;
}


/*
 * Telegram message formatter.
 */
function buildTelegramMessage(notice) {
  const source = notice.source;
  const category = notice.category;
  const title = escapeHtml(notice.title);
  const url = cleanUrl(notice.url);

  let sourceEmoji = "📢";

  if (source === "Dyal Singh College") {
    sourceEmoji = "🏫";
  }

  if (source === "University of Delhi") {
    sourceEmoji = "🎓";
  }

  let categoryEmoji = "📢";

  if (
    category === "Student"
  ) {
    categoryEmoji = "👥";
  }

  if (
    category === "Teaching" ||
    category === "Faculty / Teaching"
  ) {
    categoryEmoji = "👨‍🏫";
  }

  if (category === "Recruitment") {
    categoryEmoji = "💼";
  }

  if (category === "Examination") {
    categoryEmoji = "📝";
  }

  if (category === "General University") {
    categoryEmoji = "🏛️";
  }

  return (
    `<b>${sourceEmoji} NEW NOTICE</b>\n\n` +

    `<b>Source:</b> ${escapeHtml(source)}\n` +

    `<b>Type:</b> ${categoryEmoji} ${escapeHtml(category)}\n\n` +

    `<b>📌 ${title}</b>\n\n` +

    `🔗 <a href="${url}">View Official Notice</a>`
  );
}


/*
 * Send notification to Telegram.
 */
async function sendTelegramMessage(notice) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error(
      "Telegram environment variables are missing"
    );
  }

  const message = buildTelegramMessage(notice);

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram error: ${JSON.stringify(data)}`
    );
  }

  return data;
}


/*
 * Process one category.
 *
 * First run:
 * Save existing notices only.
 *
 * Later runs:
 * New notices are sent to Telegram.
 */
async function processCategory(
  notices,
  isFirstRun
) {
  let checked = 0;
  let inserted = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const notice of notices) {
    checked++;

    const cleanNotice = {
      source: String(notice.source || "").trim(),
      category: String(notice.category || "").trim(),
      title: String(notice.title || "").trim(),
      url: cleanUrl(notice.url)
    };

    if (
      !cleanNotice.source ||
      !cleanNotice.category ||
      !cleanNotice.title ||
      !cleanNotice.url
    ) {
      continue;
    }

    const noticeKey = makeNoticeKey(cleanNotice);

    const encodedKey =
      encodeURIComponent(noticeKey);

    /*
     * Check duplicate.
     */
    const existing = await supabaseRequest(
      `notices?select=id,sent&notice_key=eq.${encodedKey}&limit=1`
    );

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    /*
     * Save notice.
     */
    await supabaseRequest(
      "notices",
      {
        method: "POST",

        headers: {
          Prefer: "return=minimal"
        },

        body: JSON.stringify({
          ...cleanNotice,
          notice_key: noticeKey,
          sent: false
        })
      }
    );

    inserted++;

    /*
     * First run = baseline only.
     *
     * Do NOT send old notices.
     */
    if (isFirstRun) {
      continue;
    }

    /*
     * New notice = send Telegram.
     */
    try {
      await sendTelegramMessage(
        cleanNotice
      );

      /*
       * Mark as sent.
       */
      await supabaseRequest(
        `notices?notice_key=eq.${encodedKey}`,
        {
          method: "PATCH",

          headers: {
            Prefer: "return=minimal"
          },

          body: JSON.stringify({
            sent: true
          })
        }
      );

      sent++;

    } catch (telegramError) {
      failed++;

      console.error(
        telegramError
      );
    }
  }

  return {
    checked,
    inserted,
    sent,
    skipped,
    failed
  };
}


/*
 * Check whether a specific source/category
 * already has a baseline in Supabase.
 */
async function isCategoryFirstRun(
  source,
  category
) {
  const encodedSource =
    encodeURIComponent(source);

  const encodedCategory =
    encodeURIComponent(category);

  const rows = await supabaseRequest(
    `notices?select=id&source=eq.${encodedSource}&category=eq.${encodedCategory}&limit=1`
  );

  return !rows || rows.length === 0;
}


/*
 * Main API handler.
 */
export default async function handler(
  req,
  res
) {
  try {

    /*
     * Environment checks.
     */
    if (!process.env.SUPABASE_URL) {
      throw new Error(
        "SUPABASE_URL is missing"
      );
    }

    if (!process.env.SUPABASE_SECRET_KEY) {
      throw new Error(
        "SUPABASE_SECRET_KEY is missing"
      );
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error(
        "TELEGRAM_BOT_TOKEN is missing"
      );
    }

    if (!process.env.TELEGRAM_CHAT_ID) {
      throw new Error(
        "TELEGRAM_CHAT_ID is missing"
      );
    }


    /*
     * Fetch DSC.
     */
    const dscStudent =
      await getDSCStudentNotices();

    const dscTeaching =
      await getDSCTeachingNotices();


    /*
     * Fetch DU.
     */
    const duRaw =
      await getDUNotices();

    const duNotices =
      prepareDUNotices(duRaw);


    /*
     * Find first-run status separately.
     */
    const dscStudentFirstRun =
      await isCategoryFirstRun(
        "Dyal Singh College",
        "Student"
      );

    const dscTeachingFirstRun =
      await isCategoryFirstRun(
        "Dyal Singh College",
        "Teaching"
      );


    /*
     * DU can contain multiple categories.
     * Each category gets its own baseline.
     */
    const duCategories = [
      "Student",
      "Faculty / Teaching",
      "Recruitment",
      "Examination",
      "General University"
    ];

    const duFirstRun = {};

    for (const category of duCategories) {
      duFirstRun[category] =
        await isCategoryFirstRun(
          "University of Delhi",
          category
        );
    }


    /*
     * Process DSC Student.
     */
    const studentResult =
      await processCategory(
        dscStudent.map((notice) => ({
          ...notice,
          source: "Dyal Singh College",
          category: "Student"
        })),
        dscStudentFirstRun
      );


    /*
     * Process DSC Teaching.
     */
    const teachingResult =
      await processCategory(
        dscTeaching.map((notice) => ({
          ...notice,
          source: "Dyal Singh College",
          category: "Teaching"
        })),
        dscTeachingFirstRun
      );


    /*
     * Process DU categories separately.
     */
    const duResults = {};

    for (const category of duCategories) {

      const categoryNotices =
        duNotices.filter(
          (notice) =>
            notice.category === category
        );

      duResults[category] =
        await processCategory(
          categoryNotices,
          duFirstRun[category]
        );
    }


    /*
     * Final response.
     */
    return res.status(200).json({
      success: true,

      dsc: {
        student: {
          mode: dscStudentFirstRun
            ? "BASELINE"
            : "MONITORING",

          ...studentResult
        },

        teaching: {
          mode: dscTeachingFirstRun
            ? "BASELINE"
            : "MONITORING",

          ...teachingResult
        }
      },

      du: duResults
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
