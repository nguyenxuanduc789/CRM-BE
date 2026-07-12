const crypto      = require("crypto");
const LMSRecording = require("../models/lms_recording.model");
const LMSZoomMeeting = require("../models/lms_zoom_meeting.model");

const ZOOM_WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET || "";

class LMSZoomWebhookController {

  static async handleWebhook(req, res) {
    try {
      const { event } = req.body;
      console.log(`[Zoom Webhook] Event: ${event}`);

      // 1. Xử lý URL Validation Challenge trước tiên
      if (event === "endpoint.url_validation") {
        const plainToken = req.body.payload?.plainToken;
        if (!plainToken) return res.status(400).json({ message: "Missing plainToken" });

        const hashForValidation = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET)
          .update(plainToken).digest("hex");
          
        console.log(`[Zoom Webhook] Responding to CRC challenge with encrypted token`);
        return res.status(200).json({
          plainToken: plainToken,
          encryptedToken: hashForValidation
        });
      }

      // 2. Xác thực chữ ký từ Zoom (nếu cấu hình) cho các sự kiện khác
      if (ZOOM_WEBHOOK_SECRET && req.headers["x-zm-signature"]) {
        const signature = req.headers["x-zm-signature"];
        const timestamp = req.headers["x-zm-request-timestamp"] || "";
        const message = `v0:${timestamp}:${JSON.stringify(req.body)}`;
        
        const hash = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET)
          .update(message).digest("hex");
          
        if (signature !== `v0=${hash}`) {
          console.warn(`[Zoom Webhook] Invalid signature. Expected v0=${hash}, got ${signature}`);
          return res.status(401).json({ message: "Invalid signature" });
        }
      }

      // 3. Xử lý các sự kiện khác
      switch (event) {
        case "recording.completed": {
          const { object } = req.body.payload;
          if (!object) return res.status(400).json({ message: "Missing object payload" });

          // Tìm phòng học tương ứng để lấy thông tin khóa học và giáo viên
          const meeting = await LMSZoomMeeting.findOne({ meetingId: object.id.toString() })
            .populate("course");

          let saved = 0;
          if (object.recording_files && object.recording_files.length > 0) {
            for (const file of object.recording_files) {
              const record = new LMSRecording({
                meetingId:     object.id.toString(),
                topic:         meeting ? meeting.topic : object.topic,
                hostEmail:     object.host_email,
                startTime:     new Date(object.start_time),
                endTime:       new Date(file.recording_end || Date.now()),
                duration:      object.duration * 60 || 0, // Convert minutes to seconds or keep as is
                fileSize:      file.file_size || 0,
                downloadUrl:   file.download_url,
                playUrl:       file.play_url,
                recordingType: file.recording_type,
                status:        "completed",
                zoomPayload:   file,
              });
              await record.save();
              saved++;
            }
          }
          console.log(`[Zoom Webhook] Saved ${saved} recording(s) for meeting ${object.id}`);
          return res.status(200).json({ success: true, saved });
        }

        default:
          return res.status(200).json({ success: true, message: "Event ignored" });
      }
    } catch (err) {
      console.error("[Zoom Webhook] Error:", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/lms/recordings  → Lấy danh sách recording
  static async getRecordings(req, res) {
    try {
      const { meetingId, courseId } = req.query;
      const filter = {};
      if (meetingId) filter.meetingId = meetingId;
      if (courseId)  filter.course    = courseId;

      const recordings = await LMSRecording.find(filter)
        .sort({ createdAt: -1 })
        .limit(50);

      res.status(200).json({ success: true, data: recordings });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = LMSZoomWebhookController;
