import {
  getDSCStudentNotices,
  getDSCTeachingNotices
} from "../lib/dsc.js";

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

async function sendTelegramMessage(notice) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Telegram environment variables are missing");
  }

  const title = escapeHtml(notice.title);
  const url = cleanUrl(notice.url);

  const message =
    `<b>📢 New DSC ${notice.category} Notice</b>\n\n` +
    `<b>${title}</b>\n\n` +
    `🔗 <a href="${url}">View Notice</a>\n\n` +
    `🏫 Dyal Singh College`;

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

async function processCategory(
  notices,
  category,
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
      source: "Dyal Singh College",
      category,
      title: String(notice.title || "").trim(),
      url: cleanUrl(notice.url)
    };

    if (!cleanNotice.title || !cleanNotice.url) {
      continue;
    }

    const noticeKey = makeNoticeKey(cleanNotice);

    const encodedKey = encodeURIComponent(noticeKey);

    const existing = await supabaseRequest(
      `notices?select=id,sent&notice_key=eq.${encodedKey}&limit=1`
    );

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    // First run for a category:
    // Save existing notices but don't send them.
    if (isFirstRun) {
      await supabaseRequest("notices", {
        method: "POST",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          ...cleanNotice,
          notice_key: noticeKey,
          sent: false
        })
      });

      inserted++;
      continue;
    }

    // New notice
    await supabaseRequest("notices", {
      method: "POST",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        ...cleanNotice,
        notice_key: noticeKey,
        sent: false
      })
    });

    inserted++;

    try {
      await sendTelegramMessage(cleanNotice);

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
      console.error(telegramError);
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

export default async function handler(req, res) {
  try {
    if (!process.env.SUPABASE_URL) {
      throw new Error("SUPABASE_URL is missing");
    }

    if (!process.env.SUPABASE_SECRET_KEY) {
      throw new Error("SUPABASE_SECRET_KEY is missing");
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is missing");
    }

    if (!process.env.TELEGRAM_CHAT_ID) {
      throw new Error("TELEGRAM_CHAT_ID is missing");
    }

    // Fetch both categories
    const studentNotices =
      await getDSCStudentNotices();

    const teachingNotices =
      await getDSCTeachingNotices();

    // Check whether database already contains notices
    const existingRows = await supabaseRequest(
      "notices?select=id&limit=1"
    );

    const databaseEmpty =
      !existingRows ||
      existingRows.length === 0;

    const studentResult =
      await processCategory(
        studentNotices,
        "Student",
        databaseEmpty
      );

    /*
     * If Student notices were already in the database,
     * Teaching notices must still get their own baseline.
     */
    const teachingExistingRows =
      await supabaseRequest(
        "notices?select=id&category=eq.Teaching&limit=1"
      );

    const teachingFirstRun =
      !teachingExistingRows ||
      teachingExistingRows.length === 0;

    const teachingResult =
      await processCategory(
        teachingNotices,
        "Teaching",
        teachingFirstRun
      );

    return res.status(200).json({
      success: true,

      student: {
        mode: databaseEmpty
          ? "BASELINE"
          : "MONITORING",
        ...studentResult
      },

      teaching: {
        mode: teachingFirstRun
          ? "BASELINE"
          : "MONITORING",
        ...teachingResult
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
