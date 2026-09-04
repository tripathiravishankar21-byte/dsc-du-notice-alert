export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({
        success: true,
        message: "Telegram AI webhook is ready"
      });
    }

    const update = req.body;
    const message = update?.message;

    if (!message) {
      return res.status(200).json({
        success: true,
        message: "No message to process"
      });
    }

    // Ignore messages sent by bots
    if (message.from?.is_bot) {
      return res.status(200).json({
        success: true,
        message: "Bot message ignored"
      });
    }

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const apiKey = process.env.UNOROUTER_API_KEY;

    if (!telegramToken) {
      return res.status(500).json({
        success: false,
        error: "TELEGRAM_BOT_TOKEN is not configured"
      });
    }

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "UNOROUTER_API_KEY is not configured"
      });
    }

    const chatId = message.chat?.id;
    const userName =
      message.from?.first_name ||
      message.from?.username ||
      "User";

    let text = message.text?.trim();

    if (!text) {
      return res.status(200).json({
        success: true,
        message: "No text message to process"
      });
    }

    // Our bot username
    const botUsername = "dsc_du_notice_alert_bot";

    // Only answer when the bot is mentioned
    const mention = `@${botUsername}`;

    if (!text.toLowerCase().includes(mention.toLowerCase())) {
      return res.status(200).json({
        success: true,
        message: "Bot was not mentioned"
      });
    }

    // Remove bot mention from the question
    text = text
      .replace(new RegExp(mention, "ig"), "")
      .trim();

    if (!text) {
      return res.status(200).json({
        success: true,
        message: "Please ask a question after mentioning the bot"
      });
    }

    // Ask UnoRouter AI
    const aiResponse = await fetch(
      "https://api.unorouter.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "glm-5.3-flash:free",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful AI assistant in a Telegram group. Answer questions clearly, accurately and naturally. The users may ask questions in English, Hindi or Hinglish. Reply in the same language and style as the user's question whenever possible. For educational questions, explain concepts simply with useful examples."
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      }
    );

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("UnoRouter error:", aiData);

      return res.status(200).json({
        success: false,
        error: "AI request failed",
        details: aiData
      });
    }

    const answer = aiData?.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(200).json({
        success: false,
        error: "AI returned an empty answer"
      });
    }

    // Telegram has a message length limit.
    // Keep a safe limit for this first version.
    const safeAnswer =
      answer.length > 3900
        ? answer.substring(0, 3890) + "..."
        : answer;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text:
            `🤖 AI Assistant\n\n` +
            `👤 ${userName}\n\n` +
            `❓ ${text}\n\n` +
            `💡 ${safeAnswer}`
        })
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      console.error("Telegram error:", telegramData);

      return res.status(200).json({
        success: false,
        error: "Telegram reply failed",
        details: telegramData
      });
    }

    return res.status(200).json({
      success: true,
      message: "AI answer sent successfully",
      model: aiData?.model || null,
      telegram_message_id:
        telegramData?.result?.message_id || null
    });

  } catch (error) {
    console.error("Telegram AI error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
