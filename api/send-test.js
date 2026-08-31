export default async function handler(req, res) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = "-5455440700";

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ DSC DU Notice Alert Bot is working!\n\n🚀 Telegram connection successful."
        })
      }
    );

    const data = await response.json();

    if (!data.ok) {
      return res.status(500).json(data);
    }

    return res.status(200).json({
      success: true,
      message: "Test message sent successfully!"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
