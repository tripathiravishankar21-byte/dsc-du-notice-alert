import { getDSCStudentNotices } from "../lib/dsc.js";

export default async function handler(req, res) {
  try {
    const notices = await getDSCStudentNotices();

    return res.status(200).json({
      success: true,
      source: "Dyal Singh College",
      category: "Student",
      count: notices.length,
      notices
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
