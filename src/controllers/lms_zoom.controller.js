const crypto = require("crypto");
const LMSZoomMeeting = require("../models/lms_zoom_meeting.model");

class LMSZoomController {
  static async getMeeting(req, res) {
    try {
      const meeting = await LMSZoomMeeting.findById(req.params.id)
        .populate("course", "title slug")
        .populate("host", "firstname lastname email");

      if (!meeting) {
        return res.status(404).json({ success: false, message: "Meeting not found" });
      }

      res.status(200).json({ success: true, data: meeting });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMeetingByRoomName(req, res) {
    try {
      const meeting = await LMSZoomMeeting.findOne({ meetingId: req.params.roomName })
        .populate("course", "title slug")
        .populate("host", "fullName email");

      if (!meeting) {
        return res.status(404).json({ success: false, message: "Không tìm thấy phòng học" });
      }

      res.status(200).json({ success: true, data: meeting });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Lấy danh sách toàn bộ các buổi học Zoom
  static async getMeetings(req, res) {
    try {
      const meetings = await LMSZoomMeeting.find()
        .populate("course", "title slug imageUrl")
        .populate("host", "fullName email")
        .sort({ startTime: 1 });
      
      res.status(200).json({ success: true, data: meetings });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Sinh chữ ký (Signature) cho Zoom Web SDK
  static generateSignature(req, res) {
    try {
      const { meetingNumber, role } = req.body;
      
      const sdkKey = process.env.ZOOM_SDK_KEY || "YOUR_ZOOM_SDK_KEY";
      const sdkSecret = process.env.ZOOM_SDK_SECRET || "YOUR_ZOOM_SDK_SECRET";

      if (!meetingNumber || role === undefined) {
        return res.status(400).json({ success: false, message: "Missing meetingNumber or role" });
      }

      // Zoom Meeting SDK Signature Logic
      const iat = Math.round(new Date().getTime() / 1000) - 30;
      const exp = iat + 60 * 60 * 2;
      const oHeader = { alg: "HS256", typ: "JWT" };

      const oPayload = {
        appKey: sdkKey,
        sdkKey: sdkKey,
        mn: meetingNumber,
        role: role,
        iat: iat,
        exp: exp,
        tokenExp: exp
      };

      const sHeader = Buffer.from(JSON.stringify(oHeader)).toString("base64url");
      const sPayload = Buffer.from(JSON.stringify(oPayload)).toString("base64url");

      const signature = crypto.createHmac("sha256", sdkSecret)
        .update(`${sHeader}.${sPayload}`)
        .digest("base64url");

      const jwtToken = `${sHeader}.${sPayload}.${signature}`;

      res.status(200).json({ success: true, signature: jwtToken });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = LMSZoomController;
