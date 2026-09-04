export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({
      success: true,
      message: "Telegram AI webhook is ready"
    });
  }

  try {
    const update = req.body;

    if (!update?.message) {
      return res.status(200).json({ success: true });
    }

    const message = update.message;

    // Ignore messages sent by bots
    if (message.from?.is_bot) {
      return res.status(200).json({ success: true });
    }

    const chatId = String(message.chat?.id || "");
    const userId = String(message.from?.id || "");
    const userName =
      message.from?.first_name ||
      message.from?.username ||
      "User";

    const text = message.text || "";

    const BOT_USERNAME = "dsc_du_notice_alert_bot";

    // Only respond when the bot is mentioned
    if (!text.toLowerCase().includes(`@${BOT_USERNAME}`.toLowerCase())) {
      return res.status(200).json({ success: true });
    }

    // Remove bot mention from the question
    const question = text
      .replace(new RegExp(`@${BOT_USERNAME}`, "ig"), "")
      .trim();

    if (!question) {
      return res.status(200).json({ success: true });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const unoRouterKey = process.env.UNOROUTER_API_KEY;

    if (
      !supabaseUrl ||
      !supabaseKey ||
      !telegramToken ||
      !unoRouterKey
    ) {
      throw new Error("Required environment variables are missing");
    }

    const supabaseHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    };

    // --------------------------------------------------
    // 1. Find this user's conversation in this group
    // --------------------------------------------------

    const conversationSearchUrl =
      `${supabaseUrl}/rest/v1/ai_conversations` +
      `?chat_id=eq.${encodeURIComponent(chatId)}` +
      `&user_id=eq.${encodeURIComponent(userId)}` +
      `&select=*` +
      `&order=created_at.desc` +
      `&limit=1`;

    const conversationSearchResponse = await fetch(
      conversationSearchUrl,
      {
        method: "GET",
        headers: supabaseHeaders
      }
    );

    if (!conversationSearchResponse.ok) {
      const errorText = await conversationSearchResponse.text();
      throw new Error(
        `Supabase conversation search failed: ${errorText}`
      );
    }

    const conversations = await conversationSearchResponse.json();

    let conversation;

    // --------------------------------------------------
    // 2. Create conversation if this user has none
    // --------------------------------------------------

    if (conversations.length === 0) {
      const createConversationResponse = await fetch(
        `${supabaseUrl}/rest/v1/ai_conversations`,
        {
          method: "POST",
          headers: {
            ...supabaseHeaders,
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            chat_id: chatId,
            user_id: userId,
            user_name: userName,
            topic: null
          })
        }
      );

      if (!createConversationResponse.ok) {
        const errorText = await createConversationResponse.text();
        throw new Error(
          `Supabase conversation creation failed: ${errorText}`
        );
      }

      const created = await createConversationResponse.json();
      conversation = created[0];
    } else {
      conversation = conversations[0];
    }

    const conversationId = conversation.id;

    // --------------------------------------------------
    // 3. Get recent conversation history
    // --------------------------------------------------

    const messagesUrl =
      `${supabaseUrl}/rest/v1/ai_messages` +
      `?conversation_id=eq.${encodeURIComponent(conversationId)}` +
      `&select=role,message,created_at` +
      `&order=created_at.desc` +
      `&limit=10`;

    const messagesResponse = await fetch(messagesUrl, {
      method: "GET",
      headers: supabaseHeaders
    });

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      throw new Error(
        `Supabase message history failed: ${errorText}`
      );
    }

    const historyRows = await messagesResponse.json();

    // Reverse so oldest message comes first
    historyRows.reverse();

    const history = historyRows.map((item) => ({
      role: item.role,
      content: item.message
    }));

    // --------------------------------------------------
    // 4. Save user's new message
    // --------------------------------------------------

    const saveUserMessageResponse = await fetch(
      `${supabaseUrl}/rest/v1/ai_messages`,
      {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify({
          conversation_id: conversationId,
          role: "user",
          message: question
        })
      }
    );

    if (!saveUserMessageResponse.ok) {
      const errorText = await saveUserMessageResponse.text();
      throw new Error(
        `Supabase user message save failed: ${errorText}`
      );
    }

    // --------------------------------------------------
    // 5. Ask UnoRouter AI
    // --------------------------------------------------

    const aiMessages = [
      {
        role: "system",
        content:
          "You are a helpful AI study assistant inside a Telegram group. " +
          "Answer accurately and clearly. " +
          "Match the user's language and style, including Hindi, English, or Hinglish. " +
          "For educational questions, explain concepts simply with useful examples. " +
          "Use the previous conversation context when it is relevant. " +
          "Do not assume that messages from other group members are part of this user's conversation."
      },
      ...history,
      {
        role: "user",
        content: question
      }
    ];

    const aiResponse = await fetch(
      "https://api.unorouter.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${unoRouterKey}`
        },
        body: JSON.stringify({
          model: "glm-5.3-flash:free",
          messages: aiMessages,
          temperature: 0.7,
          max_tokens: 1200
        })
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(
        `UnoRouter request failed: ${errorText}`
      );
    }

    const aiData = await aiResponse.json();

    const answer =
      aiData?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("AI returned an empty answer");
    }

    // --------------------------------------------------
    // 6. Save AI response
    // --------------------------------------------------

    const saveAssistantMessageResponse = await fetch(
      `${supabaseUrl}/rest/v1/ai_messages`,
      {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify({
          conversation_id: conversationId,
          role: "assistant",
          message: answer
        })
      }
    );

    if (!saveAssistantMessageResponse.ok) {
      const errorText = await saveAssistantMessageResponse.text();
      throw new Error(
        `Supabase assistant message save failed: ${errorText}`
      );
    }

    // --------------------------------------------------
    // 7. Send answer to Telegram
    // --------------------------------------------------

    const telegramText =
      `🤖 AI Assistant\n\n` +
      `👤 ${userName}\n\n` +
      `❓ ${question}\n\n` +
      `💡 ${answer}`;

    // Telegram message limit protection
    const finalText =
      telegramText.length > 3900
        ? telegramText.substring(0, 3897) + "..."
        : telegramText;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: finalText
        })
      }
    );

    if (!telegramResponse.ok) {
      const errorText = await telegramResponse.text();
      throw new Error(
        `Telegram sendMessage failed: ${errorText}`
      );
    }

    const telegramData = await telegramResponse.json();

    return res.status(200).json({
      success: true,
      memory: true,
      conversation_id: conversationId,
      telegram_message_id: telegramData?.result?.message_id
    });

  } catch (error) {
    console.error("AI Telegram error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
