const { findByEmail } = require("../models/repositories/user.repository");
const {
  BadRequestError,
  ConflictRequestError,
  AuthFailureError,
  ForbiddenRequestError,
} = require("../core/error.response");
const userModel = require("../models/user.model");
const { createTokenPair, verifyJWT } = require("../auth/authUtils");
const { getInfoData } = require("../utils");
const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const { validateSignUp } = require("../validation/user.validate");
const { data_map } = require("../constant/country");
const { sendConfirmationEmail } = require("../library/Mail/init.mailer");
const { Types } = require("mongoose");
const code_mailsSchema = require("../models/codemail.model");

class AuthService {
  static logout = async ({ _id }) => {
    const delKey = await KeyTokenService.removeKeyById(_id);
    return delKey;
  };
  static login = async ({ email, password }) => {
    const foundUser = await findByEmail({ email, password });
    const match = await bcrypt.compare(password, foundUser.password);
    const tokens = await createTokenPair(
      foundUser,
      process.env.PUBLIC_KEY,
      process.env.PRIVATE_KEY
    );
    const employeeCodes = foundUser.employeeCode;
    const lastnames = foundUser.lastname;
    const firstnames = foundUser.firstname;
    const userId = foundUser._id;
    //console.log("User role:", foundUser.role ? foundUser.role.name : "No role");
    if (!match) throw new AuthFailureError("Authentication error");
    if (!foundUser) {
      throw new BadRequestError("Tài khoản hoặc mật khẩu không đúng");
    }

    return {
      employeeCodes,
      firstnames,
      lastnames,
      userId,
      role: foundUser.role ? foundUser.role.name : "No role",
      access_token: tokens,
      token_type: "bearer",
    };
  };

  static signUp = async (body) => {
    const { email, password, lastname, firstname, role } = body;
    if (!email || !password || !lastname || !firstname) {
      throw new BadRequestError("Vui lòng cung cấp đủ thông tin bắt buộc");
    }
    const holderUser = await userModel.findOne({ email }).lean();
    if (holderUser) {
      throw new BadRequestError("Tài khoản đã tồn tại");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await userModel.create({
      lastname,
      firstname,
      email,
      password: passwordHash,
      role,
    });

    // Trả về kết quả thành công nếu tạo người dùng thành công
    if (newUser) {
      // Thực hiện các thao tác khác (nếu cần)
      return {
        success: true,
        data: newUser._id,
      };
    }
  };
  static va = async ({ user }) => {
    console.log(user);
    //step1: check email exists??
    const holderUser = await userModel.findOne({ email: user.email }).lean();
    if (!holderUser) {
      throw new BadRequestError("Tài khoản không tồn tại");
    }
    return {
      code: 202,
      metadata: {
        info_user: getInfoData({
          fields: ["_id", "name", "email"],
          object: holderUser,
        }),
      },
    };
  };
  static sendCodeEmail = async (body) => {
    const { email } = body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestError("Vui lòng cung cấp một địa chỉ email hợp lệ");
    }

    const holderUser = await userModel.findOne({ email }).lean();
    if (holderUser) {
      throw new BadRequestError("Tài khoản đã tồn tại");
    }
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const requestCount = await code_mailsSchema.countDocuments({
      email: email,
      createdAt: { $gte: oneHourAgo },
    });
    if (requestCount >= 5) {
      throw new BadRequestError(
        "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau 1 giờ."
      );
    }
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const newCode = await code_mailsSchema.create({
      email,
      code,
    });
    if (!newCode) {
      throw new BadRequestError("Vui lòng thử lại");
    }
    await sendConfirmationEmail(email, code);
    return {
      email: email,
    };
  };
  static verifyEmail = async (body) => {
    const { email, code } = body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestError("Vui lòng cung cấp một địa chỉ email hợp lệ");
    }
    if (!code || typeof code !== "string" || code.length !== 5) {
      throw new BadRequestError("Vui lòng cung cấp một mã hợp lệ");
    }
    const existingCode = await code_mailsSchema.findOne({ email, code }).lean();
    if (!existingCode) {
      throw new BadRequestError("Mã không hợp lệ hoặc đã hết hạn");
    }
    await code_mailsSchema.updateOne({ email, code }, { is_verify: true });
    return {
      is_verified: true,
    };
  };
}
module.exports = AuthService;
