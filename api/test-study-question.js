export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.UNOROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "UNOROUTER_API_KEY is missing"
      });
    }

    const subject = "DSA";
    const topic = "Linked List";
    const difficulty = "Medium";

    const prompt = `
Generate exactly ONE multiple-choice question for a student.

Subject: ${subject}
Topic: ${topic}
Difficulty: ${difficulty}

Return ONLY valid JSON.
Do not use markdown.
Do not use code fences.

Required JSON format:

{
  "question": "Question text",
  "option_a": "Option A",
  "option_b": "Option B",
  "option_c": "Option C",
  "option_d": "Option D",
  "correct_answer": "A",
  "explanation": "Short explanation"
}

Rules:
- correct_answer must be exactly A, B, C, or D.
- Only one option must be correct.
- The question should genuinely test ${topic}.
- Keep the explanation short and educational.
`;

    const response = await fetch(
      "https://api.unorouter.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "glm-5.3-flash:free",
          messages: [
            {
              role: "system",
              content:
                "You are an expert computer science exam question generator."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.4,
          max_tokens: 500
        })
      }
    );

    const rawText = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        error: "UnoRouter request failed",
        status: response.status,
        details: rawText
      });
    }

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(500).json({
        error: "UnoRouter returned invalid JSON",
        raw: rawText
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "No AI response content",
        response: data
      });
    }

    let cleanContent = content.trim();

    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
    }

    let question;

    try {
      question = JSON.parse(cleanContent);
    } catch {
      return res.status(500).json({
        error: "AI response was not valid question JSON",
        raw: content
      });
    }

    const requiredFields = [
      "question",
      "option_a",
      "option_b",
      "option_c",
      "option_d",
      "correct_answer",
      "explanation"
    ];

    for (const field of requiredFields) {
      if (
        !question[field] ||
        typeof question[field] !== "string"
      ) {
        return res.status(500).json({
          error: `Missing or invalid field: ${field}`,
          question
        });
      }
    }

    question.correct_answer =
      question.correct_answer.trim().toUpperCase();

    if (!["A", "B", "C", "D"].includes(question.correct_answer)) {
      return res.status(500).json({
        error: "Invalid correct_answer",
        question
      });
    }

    return res.status(200).json({
      success: true,
      subject,
      topic,
      difficulty,
      question
    });
  } catch (error) {
    console.error("Study question error:", error);

    return res.status(500).json({
      error: error.message
    });
  }
}
