
export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: "Supabase environment variables are missing"
      });
    }

    const testNotice = {
      source: "Test",
      category: "Student",
      title: "DSC Notice Alert - Database Test",
      url: "https://www.dsc.du.ac.in/",
      notice_key: "test-notice-001",
      sent: false
    };

    const response = await fetch(
      `${supabaseUrl}/rest/v1/notices`,
      {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(testNotice)
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        response: text
      });
    }

    return res.status(200).json({
      success: true,
      message: "Test notice inserted successfully!",
      database: "Connected",
      table: "notices",
      inserted: JSON.parse(text)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
