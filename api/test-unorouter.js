export default async function handler(req, res) {
  try {
    const apiKey = process.env.UNOROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "UNOROUTER_API_KEY is not configured"
      });
    }

    const response = await fetch(
      "https://api.unorouter.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-oss-120b:free",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful AI assistant. Answer clearly and naturally."
            },
            {
              role: "user",
              content: "Hello! Please introduce yourself in one short paragraph."
            }
          ],
          temperature: 0.7
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "UnoRouter API request failed",
        details: data
      });
    }

    const answer = data?.choices?.[0]?.message?.content;

    return res.status(200).json({
      success: true,
      message: "UnoRouter API is working!",
      model: data.model || "gpt-oss-120b:free",
      answer: answer || null
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
