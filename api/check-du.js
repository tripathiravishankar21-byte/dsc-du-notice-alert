import { getDUNotices } from "../lib/du.js";

export default async function handler(req, res) {
  try {
    const notices = await getDUNotices();

    return res.status(200).json({
      success: true,
      source: "University of Delhi",
      category: "Official Notification",
      count: notices.length,
      notices
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
