export default async function handler(req, res) {
  try {
    // Telegram only sends updates using POST
    if (req.method !== "POST") {
      return res.status(200).json({
        success: true,
        message: "Telegram AI webhook is ready"
      });
    }

    const update = req.body;

    // Check whether this update contains a text message
    const message = update?.message;

    if (!message) {
      return res.status(200).json({
        success: true,
        message: "No message to process"
      });
    }

    const chatId = message.chat?.id;
    const userName =
      message.from?.first_name ||
      message.from?.username ||
      "User";

    const text = message.text?.trim();

    if (!text) {
      return res.status(200).json({
        success: true,
        message: "Message has no text"
      });
    }

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!telegramToken) {
      return res.status(500).json({
        success: false,
        error: "TELEGRAM_BOT_TOKEN is not configured"
      });
    }

    // Temporary test reply
    const reply =
      `👋 Hello ${userName}!\n\n` +
      `I received your message:\n\n` +
      `💬 ${text}\n\n` +
      `🤖 AI webhook is working.`;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply
        })
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      return res.status(telegramResponse.status || 500).json({
        success: false,
        error: "Telegram reply failed",
        details: telegramData
      });
    }

    return res.status(200).json({
      success: true,
      message: "Telegram webhook received successfully",
      telegram_message_id:
        telegramData?.result?.message_id || null
    });

  } catch (error) {
    console.error("AI Telegram webhook error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
