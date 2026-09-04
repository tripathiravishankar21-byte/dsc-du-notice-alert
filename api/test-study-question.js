export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Only GET method is allowed"
    });
  }

  try {
    const unoRouterKey = process.env.UNOROUTER_API_KEY;

    if (!unoRouterKey) {
      throw new Error("UNOROUTER_API_KEY is missing");
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
Do not put JSON inside code fences.

Required JSON format:

{
  "question": "Question text",
  "option_a": "Option A",
  "option_b": "Option B",
  "option_c": "Option C",
  "option_d": "Option D",
  "correct_answer": "C",
  "explanation": "Short explanation"
}

Rules:
- correct_answer must be exactly A, B, C, or D.
- Only one option can be correct.
- The explanation must explain why the correct answer is correct.
- Make the question technically accurate.
`;

    const response = await fetch(
      "https://api.unorouter.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${unoRouterKey}`
        },
        body: JSON.stringify({
          model: "glm-5.3-flash:free",
          messages: [
            {
              role: "system",
              content:
                "You are a precise computer science question generator. " +
                "Always follow the requested JSON format exactly."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 700
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `UnoRouter failed: ${await response.text()}`
      );
    }

    const data = await response.json();

    const rawAnswer =
      data?.choices?.[0]?.message?.content?.trim();

    if (!rawAnswer) {
      throw new Error("AI returned an empty response");
    }

    // Remove accidental markdown code fences
    const cleanedAnswer = rawAnswer
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let question;

    try {
      question = JSON.parse(cleanedAnswer);
    } catch {
      throw new Error(
        `AI did not return valid JSON: ${cleanedAnswer}`
      );
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
      if (!question[field]) {
        throw new Error(
          `Missing field: ${field}`
        );
      }
    }

    const correctAnswer =
      String(question.correct_answer)
        .trim()
        .toUpperCase();

    if (!["A", "B", "C", "D"].includes(correctAnswer)) {
      throw new Error(
        "correct_answer must be A, B, C, or D"
      );
    }

    return res.status(200).json({
      success: true,
      subject,
      topic,
      difficulty,
      question: {
        ...question,
        correct_answer: correctAnswer
      }
    });

  } catch (error) {
    console.error("Study question error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
