export default async function handler(req, res) {
  try {
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

    // Test message
    const userQuestion = "What is a linked list? Explain simply.";

    // Ask UnoRouter
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
                "You are a helpful study assistant. Explain concepts clearly and simply."
            },
            {
              role: "user",
              content: userQuestion
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      }
    );

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
      return res.status(aiResponse.status).json({
        success: false,
        error: "UnoRouter API request failed",
        details: aiData
      });
    }

    const answer = aiData?.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(500).json({
        success: false,
        error: "AI returned an empty answer"
      });
    }

    // Send AI answer to Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `🤖 AI Test\n\n❓ ${userQuestion}\n\n💡 ${answer}`
        })
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      return res.status(telegramResponse.status || 500).json({
        success: false,
        error: "Telegram message failed",
        details: telegramData
      });
    }

    return res.status(200).json({
      success: true,
      message: "AI → Telegram test successful!",
      model: aiData?.model || null,
      telegram_message_id: telegramData?.result?.message_id || null,
      answer
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
