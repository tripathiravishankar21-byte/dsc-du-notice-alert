export default async function handler(req, res) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    const response = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates`
    );

    const data = await response.json();

    if (!data.ok) {
      return res.status(500).json({
        error: "Telegram API error"
      });
    }

    const updates = data.result;

    if (updates.length === 0) {
      return res.status(200).json({
        message: "No messages found. Send /start in your Telegram group first."
      });
    }

    const latest = updates[updates.length - 1];

    const message = latest.message || latest.edited_message;

    if (!message || !message.chat) {
      return res.status(200).json({
        message: "No group message found. Send /start in the test group."
      });
    }

    return res.status(200).json({
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title || "Private Chat"
    });

  } catch (error) {
    return res.status(500).json({
      error: "Something went wrong"
    });
  }
}
