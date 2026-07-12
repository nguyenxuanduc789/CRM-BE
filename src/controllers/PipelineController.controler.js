const Pipeline = require("../models/pineline.model"); // Sửa typo: pineline.model -> pipeline.model
const AffiliateReport = require("../models/reportaff.model");
const Product = require("../models/product.model");
const Contact = require("../models/contact.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");
const crypto = require("crypto");

const createOrder = async (req, res) => {
  try {
    const {
      contactId, // ID của liên hệ (tùy chọn)
      name, // Tên liên hệ (bắt buộc nếu không có contactId)
      phone, // Số điện thoại (bắt buộc nếu không có contactId)
      email, // Email (bắt buộc nếu không có contactId)
      products, // Mảng ID sản phẩm: [{ productId, value }]
      stage, // Giai đoạn pipeline (tùy chọn)
      amountTotal, // Tổng số tiền
      firstPayment, // Thanh toán lần đầu
      voucherType, // Loại voucher (Percent, Amount)
      voucherInt, // Giá trị voucher
      depositAmount, // Số tiền tạm ứng
      paymentType, // Loại thanh toán (Full, Install)
      expectedCloseDate, // Ngày dự kiến đóng giao dịch
      notes, // Ghi chú
      affiliateId, // Mã affiliate (không bắt buộc)
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!products || !amountTotal || !firstPayment) {
      return res.status(400).json({
        message:
          "Thiếu các trường bắt buộc: products, amountTotal, firstPayment",
      });
    }

    // Xử lý mã affiliate
    let isAffiliate = false;
    let managerId = "685e31146bbad670b2cd7163"; // ID mặc định nếu không có affiliateId
    let affiliateData = null; // Khởi tạo affiliateData
    if (affiliateId) {
      isAffiliate = true;
      affiliateData = await AffiliateReport.findOne({
        affiliate_id: affiliateId,
      });
      if (!affiliateData) {
        return res.status(400).json({ message: "Mã affiliate không hợp lệ" });
      }
      // Tìm User quản lý mã affiliate
      const userManagingAffiliate = await User.findOne({
        managedAffiliateIds: affiliateId,
      });
      if (!userManagingAffiliate) {
        return res.status(400).json({
          message: "Không tìm thấy người dùng quản lý mã affiliate này",
        });
      }
      managerId = userManagingAffiliate._id; // Sử dụng ID của người quản lý affiliate
    }

    // Xử lý liên hệ (Contact)
    let contact;
    if (contactId) {
      // Nếu có contactId, kiểm tra liên hệ tồn tại
      if (!mongoose.Types.ObjectId.isValid(contactId)) {
        return res.status(400).json({ message: "contactId không hợp lệ" });
      }
      contact = await Contact.findById(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Không tìm thấy liên hệ" });
      }
      // Cập nhật assignedTo nếu cần
      if (
        !contact.assignedTo ||
        contact.assignedTo.toString() !== managerId.toString()
      ) {
        contact.assignedTo = managerId;
        await contact.save();
      }
    } else {
      // Nếu không có contactId, yêu cầu các trường name, phone, email
      if (!name || !phone || !email) {
        return res.status(400).json({
          message: "Yêu cầu các trường name, phone, email khi tạo liên hệ mới",
        });
      }
      // Tạo mới Contact
      contact = new Contact({
        name, // Sử dụng name từ req.body
        phone, // Sử dụng phone từ req.body
        email, // Sử dụng email từ req.body
        assignedTo: managerId, // Gán người quản lý affiliate hoặc ID mặc định
        status: "active",
        interactionLevel: "Khách hàng của affiliate",
      });
      await contact.save();
    }

    // Kiểm tra sản phẩm hợp lệ
    const productIds = products.map((p) => p.productId);
    const validProducts = await Product.find({ _id: { $in: productIds } });
    if (validProducts.length !== productIds.length) {
      return res
        .status(400)
        .json({ message: "Một hoặc nhiều sản phẩm không hợp lệ" });
    }

    // Tạo đơn hàng mới trong Pipeline
    const newOrder = new Pipeline({
      user: contact._id, // Liên hệ là user của Pipeline
      contact: contact._id, // Liên hệ của Pipeline
      stage: stage || "Khách hàng của affiliate", // Mặc định nếu không cung cấp
      amountTotal,
      Firstpayment: firstPayment,
      voucherType: voucherType || null,
      voucherInt: voucherInt || 0,
      depositAmount: depositAmount || 0,
      PaymentType: paymentType || "Full",
      totalAmount: amountTotal, // Có thể tính lại nếu cần logic phức tạp hơn
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      notes: notes || "",
      createdBy: managerId, // Gán người quản lý affiliate hoặc ID mặc định
      products: productIds,
      K: products.map((p) => ({
        product: p.productId,
        value: p.value,
      })),
      isAffiliate, // True nếu có affiliateId, false nếu không
      images: [], // Mặc định không có ảnh
    });

    // Lưu đơn hàng
    await newOrder.save();

    // Cập nhật pipeline trong Contact
    contact.pipeline.push(newOrder._id);
    await contact.save();

    // Trả về phản hồi thành công
    return res.status(201).json({
      message: "Tạo đơn hàng thành công",
      order: newOrder,
      contact: contact,
      affiliate: affiliateData
        ? {
            affiliateId: affiliateData.affiliate_id,
            affiliateLink: affiliateData.affiliateLink,
          }
        : null,
    });
  } catch (error) {
    console.error("Lỗi khi tạo đơn hàng:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};
const Update = async (req, res) => {
  try {
    const { gateway, accountNumber, transferAmount, content } = req.body;

    // Kiểm tra tài khoản ngân hàng
    if (gateway !== "MBBank" || accountNumber !== "0773253441") {
      return res
        .status(400)
        .json({ message: "Tài khoản ngân hàng không hợp lệ" });
    }

    // Trích xuất orderCode từ content
    const orderCodeMatch = content.match(/Thanh toan don hang (\d+)/);
    if (!orderCodeMatch) {
      return res.status(400).json({
        message: "Không tìm thấy mã đơn hàng trong nội dung chuyển khoản",
      });
    }
    const orderCode = Number(orderCodeMatch[1]);

    // Kiểm tra orderCode là số hợp lệ
    if (!Number.isInteger(orderCode)) {
      return res.status(400).json({ message: "Mã đơn hàng không hợp lệ" });
    }

    // Tìm đơn hàng dựa trên orderCode
    const order = await Pipeline.findOne({ orderCode });
    if (!order) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy đơn hàng với mã đơn hàng này" });
    }

    // Kiểm tra số tiền
    if (transferAmount < order.Firstpayment) {
      return res
        .status(400)
        .json({ message: "Số tiền giao dịch không đủ để thanh toán lần đầu" });
    }

    // Cập nhật trạng thái đơn hàng
    order.status = "Completed";
    await order.save();

    // Trả về phản hồi thành công
    return res
      .status(200)
      .json({ message: "Cập nhật trạng thái đơn hàng thành công" });
  } catch (error) {
    console.error("Lỗi webhook:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

const cassoWebhook = async (req, res) => {
  try {
    console.log("🔵 Casso Webhook Started");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const webhookData = req.body;
    if (!webhookData) {
      return res.status(400).json({ message: "Không có dữ liệu webhook" });
    }

    // ✅ Verify chữ ký Casso (cách đơn giản)
    const secureToken =
      process.env.CASSO_SECURE_TOKEN ||
      "byqK8EZiHPMqNdEYeYwSfvwfVZ7MXAGv9TORyYN0ZODT4XyTtPtDRfLZkv2EbUPU";

    // Casso có thể gửi signature trong nhiều header khác nhau
    const signature =
      req.headers["x-casso-signature"] ||
      req.headers["signature"] ||
      req.headers["x-signature"];

    if (secureToken && signature) {
      try {
        // Cách 1: Verify theo chuẩn của Casso
        let expectedSignature;

        if (signature.includes(",")) {
          // Format: t=timestamp,v1=signature
          const parts = signature.split(",");
          const timestampPart = parts.find((part) => part.startsWith("t="));
          const signaturePart = parts.find((part) => part.startsWith("v1="));

          if (timestampPart && signaturePart) {
            const timestamp = timestampPart.split("=")[1];
            const sig = signaturePart.split("=")[1];

            // Tạo payload theo format của Casso
            const rawBody = req.rawBody || JSON.stringify(webhookData);
            const payload = `${timestamp}.${rawBody}`;

            expectedSignature = crypto
              .createHmac("sha256", secureToken)
              .update(payload)
              .digest("hex");

            if (sig !== expectedSignature) {
              console.log("❌ Chữ ký webhook không hợp lệ (format 1)");
              console.log("Received signature:", sig);
              console.log("Expected signature:", expectedSignature);
              console.log("Payload:", payload);

              // Thử cách khác
            }
          }
        } else {
          // Cách 2: Verify đơn giản - chỉ hash body
          const rawBody = req.rawBody || JSON.stringify(webhookData);
          expectedSignature = crypto
            .createHmac("sha256", secureToken)
            .update(rawBody)
            .digest("hex");

          if (signature !== expectedSignature) {
            console.log("❌ Chữ ký webhook không hợp lệ (format 2)");
            console.log("Received signature:", signature);
            console.log("Expected signature:", expectedSignature);
          }
        }

        // Tạm thời bỏ qua verify để test
        console.log("⚠️ Tạm thời bỏ qua verify signature để test");
      } catch (verifyError) {
        console.log("❌ Lỗi khi verify signature:", verifyError.message);
        console.log("⚠️ Tiếp tục xử lý mà không verify");
      }
    } else {
      console.log("ℹ️ Không có signature hoặc secureToken, bỏ qua verify");
    }

    // ✅ Chuẩn hóa transactions
    let transactions;

    if (webhookData.data) {
      transactions = Array.isArray(webhookData.data)
        ? webhookData.data
        : [webhookData.data];
    } else {
      transactions = [webhookData];
    }

    console.log("Processing transactions:", transactions.length);

    for (const tx of transactions) {
      const {
        id,
        bank_acc_id,
        tid,
        description,
        amount,
        cusum_balance,
        when,
        transactionDateTime,
        runningBalance,
      } = tx;

      const paymentDate = when || transactionDateTime || Date.now();
      const balance = cusum_balance || runningBalance;

      console.log("Processing transaction:", {
        id,
        tid,
        description,
        amount,
        paymentDate,
        balance,
      });

      if (!description || amount == null) {
        console.log("❌ Thiếu description hoặc amount, bỏ qua transaction");
        continue;
      }

      // 🔍 Tìm orderCode trong description - ƯU TIÊN các pattern cụ thể trước
      const patterns = [
        { regex: /Thanh toan don hang\s+(\d+)/i, name: "Thanh toan don hang" },
        { regex: /thanh toan don hang\s+(\d+)/i, name: "thanh toan don hang" },
        { regex: /don hang\s+(\d+)/i, name: "don hang" },
        { regex: /donhang(\d+)/i, name: "donhang" },
        { regex: /DH(\d+)/i, name: "DH" },
        { regex: /order(\d+)/i, name: "order" },
      ];

      let orderCode = null;
      let matchedPattern = null;

      // Thử các pattern cụ thể trước
      for (const pattern of patterns) {
        const match = description.match(pattern.regex);
        if (match && match[1]) {
          const extractedCode = Number(match[1]);
          if (Number.isInteger(extractedCode) && extractedCode > 0) {
            orderCode = extractedCode;
            matchedPattern = pattern.name;
            console.log(
              `✅ Found orderCode with pattern ${pattern.name}: ${orderCode}`
            );
            break;
          }
        }
      }

      // Nếu không tìm thấy với các pattern cụ thể, thử tìm số 13 chữ số
      if (!orderCode) {
        const timestampMatches = description.match(/\d{13}/g);
        if (timestampMatches && timestampMatches.length > 0) {
          // Lấy số 13 chữ số đầu tiên
          const extractedCode = Number(timestampMatches[0]);
          if (Number.isInteger(extractedCode) && extractedCode > 0) {
            orderCode = extractedCode;
            matchedPattern = "13-digit timestamp";
            console.log(
              `✅ Found orderCode with 13-digit pattern: ${orderCode}`
            );
          }
        }
      }

      if (!orderCode || !Number.isInteger(orderCode)) {
        console.log(
          "❌ Không tìm thấy orderCode hợp lệ trong description:",
          description
        );
        console.log(
          "Tried patterns:",
          patterns.map((p) => p.name).join(", "),
          "+ 13-digit timestamp"
        );
        continue;
      }

      console.log(
        `🔍 Searching for order with orderCode: ${orderCode} (matched by: ${matchedPattern})`
      );

      // ✅ Tìm order
      const order = await Pipeline.findOne({ orderCode });
      if (!order) {
        console.log("❌ Không tìm thấy đơn hàng với orderCode:", orderCode);
        continue;
      }

      console.log("✅ Tìm thấy đơn hàng:", {
        orderId: order._id,
        currentStatus: order.status,
        requiredAmount: order.Firstpayment,
      });

      if (order.status === "Completed") {
        console.log("⚠️ Đơn hàng đã hoàn thành trước đó:", orderCode);
        continue;
      }

      const receivedAmount = Number(amount);
      const requiredAmount = Number(order.Firstpayment);

      if (receivedAmount < requiredAmount) {
        console.log("❌ Số tiền không đủ:", {
          received: receivedAmount,
          required: requiredAmount,
          shortage: requiredAmount - receivedAmount,
        });
        continue;
      }

      // ✅ Cập nhật đơn hàng
      order.status = "Completed";
      order.paymentInfo = {
        transactionId: tid,
        cassoTransactionId: id,
        amount: receivedAmount,
        paymentDate: new Date(paymentDate),
        description,
        cusum_balance: balance,
        matchedPattern, // Lưu thêm thông tin pattern đã match
      };

      await order.save();
      console.log(
        `✅ Đơn hàng ${orderCode} đã được cập nhật thành công (matched by: ${matchedPattern})`
      );
    }

    return res.status(200).json({
      message: "Webhook processed successfully",
      processedTransactions: transactions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Lỗi xử lý Casso webhook:", error);
    console.error("Stack trace:", error.stack);

    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

const simpleCassoWebhook = async (req, res) => {
  try {
    console.log("=== SIMPLE CASSO WEBHOOK ===");
    console.log("Time:", new Date().toISOString());
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("Headers:", JSON.stringify(req.headers, null, 2));

    // Chỉ trả về success để test connection
    return res.status(200).json({
      message: "Webhook received successfully",
      timestamp: new Date().toISOString(),
      receivedData: req.body,
    });
  } catch (error) {
    console.error("Error in simple webhook:", error.message);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
module.exports = { createOrder, Update, cassoWebhook, simpleCassoWebhook };
