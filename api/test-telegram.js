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

  if (category === "Student") {
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

  let message =
    `<b>${sourceEmoji} NEW NOTICE</b>\n\n` +
    `<b>Source:</b> ${escapeHtml(source)}\n` +
    `<b>Type:</b> ${categoryEmoji} ${escapeHtml(category)}\n\n` +
    `<b>📌 ${title}</b>`;

  if (notice.notice_date) {
    message +=
      `\n\n📅 <b>Notice Date:</b> ${escapeHtml(
        notice.notice_date
      )}`;
  }

  message +=
    `\n\n🔗 <a href="${url}">View Official Notice</a>`;

  return message;
}

export default async function handler(req, res) {
  try {
    const token =
      process.env.TELEGRAM_BOT_TOKEN;

    const chatId =
      process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      throw new Error(
        "Telegram environment variables are missing"
      );
    }

    const testNotice = {
      source: "University of Delhi",
      category: "Student",
      title:
        "Telegram Notification System Test",
      notice_date: "31 August 2026",
      url:
        "https://www.du.ac.in/"
    };

    const message =
      buildTelegramMessage(testNotice);

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

    const data =
      await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        `Telegram error: ${JSON.stringify(data)}`
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Test Telegram notification sent successfully!",
      telegram_message_id:
        data.result?.message_id || null
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
  }
