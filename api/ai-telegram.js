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

    if (!text.toLowerCase().includes(`@${BOT_USERNAME}`.toLowerCase())) {
      return res.status(200).json({ success: true });
    }

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

    // ==================================================
    // 1. Find user's conversation
    // ==================================================

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
      throw new Error(
        `Supabase conversation search failed: ${
          await conversationSearchResponse.text()
        }`
      );
    }

    const conversations = await conversationSearchResponse.json();

    let conversation;

    // ==================================================
    // 2. Create conversation if needed
    // ==================================================

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
            topic: null,
            study_mode: false,
            study_subject: null,
            study_topic: null,
            practice_type: null
          })
        }
      );

      if (!createConversationResponse.ok) {
        throw new Error(
          `Supabase conversation creation failed: ${
            await createConversationResponse.text()
          }`
        );
      }

      const created = await createConversationResponse.json();
      conversation = created[0];
    } else {
      conversation = conversations[0];
    }

    const conversationId = conversation.id;

    // ==================================================
    // 3. Study Mode
    // ==================================================

    const lowerQuestion = question.toLowerCase().trim();

    // ---------- START STUDY MODE ----------

    if (
      lowerQuestion === "start study mode" ||
      lowerQuestion === "study mode" ||
      lowerQuestion === "start studying"
    ) {
      const responseText =
        `📚 Study Mode\n\n` +
        `Hi ${userName}! Let's start studying.\n\n` +
        `What do you want to study?\n\n` +
        `1️⃣ DSA\n` +
        `2️⃣ Operating System\n` +
        `3️⃣ DBMS\n` +
        `4️⃣ Computer Networks\n` +
        `5️⃣ Other`;

      await updateConversation(
        supabaseUrl,
        supabaseHeaders,
        conversationId,
        {
          study_mode: true,
          study_subject: null,
          study_topic: null,
          practice_type: null
        }
      );

      await sendTelegram(
        telegramToken,
        chatId,
        responseText
      );

      return res.status(200).json({
        success: true,
        mode: "study",
        step: "subject"
      });
    }

    // ---------- STUDY MODE ACTIVE ----------

    if (conversation.study_mode === true) {

      // SUBJECT SELECTION
      if (!conversation.study_subject) {
        const subjectMap = {
          "1": "DSA",
          "dsa": "DSA",

          "2": "Operating System",
          "operating system": "Operating System",
          "os": "Operating System",

          "3": "DBMS",
          "dbms": "DBMS",

          "4": "Computer Networks",
          "computer networks": "Computer Networks",
          "cn": "Computer Networks"
        };

        let subject = subjectMap[lowerQuestion];

        if (lowerQuestion === "5" || lowerQuestion === "other") {
          subject = question;
        }

        if (!subject) {
          await sendTelegram(
            telegramToken,
            chatId,
            `📚 Please select a subject:\n\n` +
            `1️⃣ DSA\n` +
            `2️⃣ Operating System\n` +
            `3️⃣ DBMS\n` +
            `4️⃣ Computer Networks\n` +
            `5️⃣ Other`
          );

          return res.status(200).json({
            success: true,
            mode: "study",
            step: "subject"
          });
        }

        await updateConversation(
          supabaseUrl,
          supabaseHeaders,
          conversationId,
          {
            study_subject: subject,
            study_topic: null,
            practice_type: null
          }
        );

        await sendTelegram(
          telegramToken,
          chatId,
          `📖 Great! ${subject} selected.\n\n` +
          `What topic do you want to practice?\n\n` +
          `For example:\n` +
          `• Linked List\n` +
          `• Stack\n` +
          `• Queue\n` +
          `• Trees\n` +
          `• Graph\n` +
          `• Sorting\n\n` +
          `✍️ Type your topic.`
        );

        return res.status(200).json({
          success: true,
          mode: "study",
          step: "topic",
          subject
        });
      }

      // TOPIC SELECTION
      if (!conversation.study_topic) {
        const topic = question;

        await updateConversation(
          supabaseUrl,
          supabaseHeaders,
          conversationId,
          {
            study_topic: topic,
            practice_type: null
          }
        );

        await sendTelegram(
          telegramToken,
          chatId,
          `📚 Subject: ${conversation.study_subject}\n` +
          `📖 Topic: ${topic}\n\n` +
          `📝 How do you want to practice?\n\n` +
          `1️⃣ Objective\n` +
          `2️⃣ Subjective`
        );

        return res.status(200).json({
          success: true,
          mode: "study",
          step: "practice_type",
          subject: conversation.study_subject,
          topic
        });
      }

      // PRACTICE TYPE
      if (!conversation.practice_type) {
        let practiceType = null;

        if (
          lowerQuestion === "1" ||
          lowerQuestion === "objective" ||
          lowerQuestion === "mcq"
        ) {
          practiceType = "Objective";
        }

        if (
          lowerQuestion === "2" ||
          lowerQuestion === "subjective"
        ) {
          practiceType = "Subjective";
        }

        if (!practiceType) {
          await sendTelegram(
            telegramToken,
            chatId,
            `📝 Please choose one:\n\n` +
            `1️⃣ Objective\n` +
            `2️⃣ Subjective`
          );

          return res.status(200).json({
            success: true,
            mode: "study",
            step: "practice_type"
          });
        }

        await updateConversation(
          supabaseUrl,
          supabaseHeaders,
          conversationId,
          {
            practice_type: practiceType
          }
        );

        await sendTelegram(
          telegramToken,
          chatId,
          `✅ Study setup complete!\n\n` +
          `📚 Subject: ${conversation.study_subject}\n` +
          `📖 Topic: ${conversation.study_topic}\n` +
          `📝 Type: ${practiceType}\n\n` +
          `🎯 Practice system is ready.\n\n` +
          `The next step will be question generation.`
        );

        return res.status(200).json({
          success: true,
          mode: "study",
          step: "ready",
          subject: conversation.study_subject,
          topic: conversation.study_topic,
          practice_type: practiceType
        });
      }
    }

    // ==================================================
    // 4. Conversation history
    // ==================================================

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
      throw new Error(
        `Supabase message history failed: ${
          await messagesResponse.text()
        }`
      );
    }

    const historyRows = await messagesResponse.json();

    historyRows.reverse();

    const history = historyRows.map((item) => ({
      role: item.role,
      content: item.message
    }));

    // ==================================================
    // 5. Save user message
    // ==================================================

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
      throw new Error(
        `Supabase user message save failed: ${
          await saveUserMessageResponse.text()
        }`
      );
    }

    // ==================================================
    // 6. Notice detection
    // ==================================================

    const noticeKeywords = [
      "notice",
      "notices",
      "notification",
      "notifications",
      "circular",
      "announcement",
      "latest update",
      "latest updates",
      "latest notice",
      "latest notices",
      "dsc notice",
      "du notice",
      "college notice",
      "university notice",
      "exam notice",
      "admission notice",
      "result notice",
      "recruitment notice",
      "vacancy notice",
      "holiday notice",
      "date sheet",
      "deadline",
      "last date"
    ];

    const isNoticeQuestion = noticeKeywords.some((keyword) =>
      lowerQuestion.includes(keyword)
    );

    let noticeContext = "";

    if (isNoticeQuestion) {
      const noticesUrl =
        `${supabaseUrl}/rest/v1/notices` +
        `?select=source,category,title,url,notice_date,detected_at` +
        `&order=detected_at.desc` +
        `&limit=30`;

      const noticesResponse = await fetch(noticesUrl, {
        method: "GET",
        headers: supabaseHeaders
      });

      if (!noticesResponse.ok) {
        throw new Error(
          `Supabase notices search failed: ${
            await noticesResponse.text()
          }`
        );
      }

      const notices = await noticesResponse.json();

      if (notices.length > 0) {
        noticeContext = notices
          .map((notice, index) => {
            return (
              `Notice ${index + 1}:\n` +
              `Source: ${notice.source || "Unknown"}\n` +
              `Category: ${notice.category || "Unknown"}\n` +
              `Title: ${notice.title || "Untitled"}\n` +
              `Notice date: ${notice.notice_date || "Unknown"}\n` +
              `Detected: ${notice.detected_at || "Unknown"}\n` +
              `URL: ${notice.url || "No URL"}`
            );
          })
          .join("\n\n");
      } else {
        noticeContext =
          "No notices are currently stored in the database.";
      }
    }

    // ==================================================
    // 7. AI
    // ==================================================

    const systemPrompt =
      "You are a helpful AI assistant inside a Telegram group. " +
      "Answer accurately and clearly. " +
      "Match the user's language and style, including Hindi, English, or Hinglish. " +
      "For educational questions, explain concepts simply with examples. " +
      "Use previous conversation context when relevant. " +
      "Never assume messages from other group members belong to this user's conversation.";

    const aiMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history
    ];

    if (isNoticeQuestion) {
      aiMessages.push({
        role: "system",
        content:
          "The user is asking about DSC/DU notices. " +
          "Use the following notices retrieved from the database. " +
          "Do not invent information.\n\n" +
          noticeContext
      });
    }

    aiMessages.push({
      role: "user",
      content: question
    });

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
          max_tokens: 1400
        })
      }
    );

    if (!aiResponse.ok) {
      throw new Error(
        `UnoRouter request failed: ${await aiResponse.text()}`
      );
    }

    const aiData = await aiResponse.json();

    const answer =
      aiData?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("AI returned an empty answer");
    }

    // ==================================================
    // 8. Save AI answer
    // ==================================================

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
      throw new Error(
        `Supabase assistant message save failed: ${
          await saveAssistantMessageResponse.text()
        }`
      );
    }

    // ==================================================
    // 9. Send answer
    // ==================================================

    const telegramText =
      `🤖 AI Assistant\n\n` +
      `👤 ${userName}\n\n` +
      `❓ ${question}\n\n` +
      `💡 ${answer}`;

    const finalText =
      telegramText.length > 3900
        ? telegramText.substring(0, 3897) + "..."
        : telegramText;

    await sendTelegram(
      telegramToken,
      chatId,
      finalText
    );

    return res.status(200).json({
      success: true,
      memory: true,
      notice_search: isNoticeQuestion,
      conversation_id: conversationId
    });

  } catch (error) {
    console.error("AI Telegram error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


// ======================================================
// Helper: Update conversation
// ======================================================

async function updateConversation(
  supabaseUrl,
  headers,
  conversationId,
  fields
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/ai_conversations?id=eq.${encodeURIComponent(conversationId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(fields)
    }
  );

  if (!response.ok) {
    throw new Error(
      `Conversation update failed: ${await response.text()}`
    );
  }
}


// ======================================================
// Helper: Send Telegram message
// ======================================================

async function sendTelegram(
  telegramToken,
  chatId,
  text
) {
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text:
          text.length > 3900
            ? text.substring(0, 3897) + "..."
            : text
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Telegram sendMessage failed: ${await response.text()}`
    );
  }

  return response.json();
}
