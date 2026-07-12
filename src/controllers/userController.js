const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const Team = require("../models/team.model");
const Role = require("../models/role.model");
const mongoose = require('mongoose');
const Affiliate = require('../models/user.affiliate.model');
// Function xử lý tạo tài khoản người dùng
const createAccount = async (req, res) => {
  try {
    const {
      email,
      firstname,
      lastname,
      password,
      role,
      managedBy,
      region,
      province,
      employeeCode,
      profileDetails, // Bao gồm dateOfBirth, bio, education, etc.
    } = req.body;

    // Lấy thông tin người dùng hiện tại
    const currentUser = await User.findById(req.user.id);

    if (!currentUser) {
      return res
        .status(403)
        .json({ message: "Người dùng hiện tại không hợp lệ" });
    }

    // Lấy thông tin vai trò hiện tại từ database
    const currentUserRole = await Role.findById(currentUser.role);

    if (!currentUserRole) {
      return res
        .status(403)
        .json({ message: "Không thể xác định vai trò người dùng hiện tại" });
    }

    const userRoleName = currentUserRole.name;
    console.log("Vai trò hiện tại: ", userRoleName);

    // Lấy thông tin vai trò mới từ database
    const newUserRole = await Role.findById(role);

    if (!newUserRole) {
      return res.status(403).json({ message: "Vai trò mới không hợp lệ" });
    }

    console.log("Vai trò mới từ database: ", newUserRole.name);

    // Kiểm tra logic với vai trò mới
    if (newUserRole.name === "KTT Sale Manager" && userRoleName !== "Admin") {
      return res
        .status(403)
        .json({ message: "Chỉ Admin mới được phép tạo KTT Sale Manager" });
    }

    if (
      newUserRole.name === "KTT Sale Team Leader" &&
      userRoleName === "KTT User"
    ) {
      return res
        .status(403)
        .json({ message: "User không thể tạo KTT Sale Team Leader" });
    }

    if (
      newUserRole.name === "KTT User" &&
      !["Admin", "KTT Sale Manager", "KTT Sale Team Leader"].includes(
        userRoleName
      )
    ) {
      return res
        .status(403)
        .json({ message: "Chỉ các cấp quản lý mới được phép tạo User" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Chuẩn bị dữ liệu mới cho người dùng
    const newUserData = {
      email,
      firstname,
      lastname,
      password: hashedPassword,
      role,
      managedBy,
      status: "active",
    };

    // Thêm các trường mới nếu có trong yêu cầu
    if (region) newUserData.region = region;
    if (province) newUserData.province = province;
    if (employeeCode) newUserData.employeeCode = employeeCode;
    if (profileDetails) newUserData.profileDetails = profileDetails;

    // Lưu dữ liệu người dùng mới
    const newUser = new User(newUserData);
    const savedUser = await newUser.save();

    // Xử lý logic khi vai trò là "KTT Sale Team Leader"
    if (newUserRole.name === "KTT Sale Team Leader") {
      const newTeam = new Team({
        name: `${firstname}'s Team`,
        leadId: savedUser._id,
        members: [],
        lead: savedUser.managedBy,
      });

      await newTeam.save();
      return res.status(201).json({
        message: `KTT Sale Team Leader và Team mới được tạo thành công`,
        data: { user: savedUser, team: newTeam },
      });
    }

    // Xử lý logic khi vai trò là "KTT User"
    if (newUserRole.name === "KTT User") {
      const leadTeam = await Team.findOne({ leadId: managedBy });

      if (!leadTeam) {
        return res
          .status(400)
          .json({ message: "Không tìm thấy Team hoặc leadId không hợp lệ" });
      }

      // Thêm user mới vào danh sách members của Team
      leadTeam.members.push(savedUser._id);
      await leadTeam.save();

      return res.status(201).json({
        message: "User mới đã được thêm vào Team thành công.",
        data: { user: savedUser, team: leadTeam },
      });
    }

    res.status(201).json({
      message: `${newUserRole.name} đã được tạo thành công`,
      data: savedUser,
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
const addAffiliateToProfile = async (req, res) => {
  const { affiliateId } = req.body;
  const { userId } = req.params;
  
  console.log("Processing userId:", userId);
  console.log("Processing affiliateId:", affiliateId);
  
  if (!affiliateId) {
    return res.status(400).json({ message: "Thiếu mã Affiliate ID" });
  }
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: "ID người dùng không hợp lệ" });
  }
  
  try {
    // Tìm user hiện tại
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    
    // Khởi tạo mảng managedAffiliateIds nếu chưa có
    if (!currentUser.managedAffiliateIds) {
      currentUser.managedAffiliateIds = [];
    }
    
    // Kiểm tra xem user này đã quản lý affiliate này chưa
    if (currentUser.managedAffiliateIds.includes(affiliateId)) {
      return res.status(400).json({ message: "Bạn đã thêm mã Affiliate này rồi" });
    }
    
    // Kiểm tra xem affiliate có tồn tại không
    const affiliate = await Affiliate.findOne({ affiliateId });
    if (!affiliate) {
      return res.status(404).json({ message: "Mã Affiliate ID không tồn tại" });
    }
    
    // Kiểm tra xem affiliate đã được quản lý bởi user khác chưa
    if (affiliate.managedBy && !affiliate.managedBy.equals(currentUser._id)) {
      return res.status(403).json({ 
        message: "Mã Affiliate này đã được quản lý bởi người dùng khác" 
      });
    }
    
    // Kiểm tra xem có user nào khác đã có affiliateId này trong managedAffiliateIds không
    const conflictUser = await User.findOne({
      _id: { $ne: currentUser._id },
      managedAffiliateIds: { $in: [affiliateId] }
    });
    
    let shouldRemoveFromDuc = false;
    
    if (conflictUser) {
      // Nếu conflictUser là "Đức" và user hiện tại không phải là "Đức"
      // thì cho phép chuyển affiliate từ Đức sang user hiện tại
      if (conflictUser.email === "ducprokb1234@gmail.com" && 
          currentUser.email !== "ducprokb1234@gmail.com") {
        shouldRemoveFromDuc = true;
        console.log(`Chuyển affiliate ${affiliateId} từ Đức sang user ${currentUser.email}`);
      }
      // Nếu user hiện tại là "Đức" thì cho phép (Đức có thể lấy lại affiliate)
      else if (currentUser.email === "ducprokb1234@gmail.com") {
        console.log(`Đức lấy lại affiliate ${affiliateId} từ user ${conflictUser.email}`);
        // Sẽ xử lý remove khỏi conflictUser trong transaction
      }
      // Nếu cả hai đều không phải là "Đức" thì không cho phép
      else {
        return res.status(403).json({ 
          message: "Mã Affiliate này đã được quản lý bởi người dùng khác trong hệ thống" 
        });
      }
    }
    
    // Bắt đầu transaction để đảm bảo tính nhất quán
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Nếu cần xóa affiliate khỏi user khác (chuyển từ Đức hoặc user khác)
      if (conflictUser) {
        // Xóa affiliateId khỏi managedAffiliateIds của conflictUser
        conflictUser.managedAffiliateIds = conflictUser.managedAffiliateIds.filter(id => id !== affiliateId);
        await conflictUser.save({ session });
        console.log(`Đã xóa affiliate ${affiliateId} khỏi user ${conflictUser.email}`);
      }
      
      // Cập nhật affiliate.managedBy
      affiliate.managedBy = currentUser._id;
      await affiliate.save({ session });
      
      // Thêm affiliateId vào managedAffiliateIds của user hiện tại
      currentUser.managedAffiliateIds.push(affiliateId);
      await currentUser.save({ session });
      
      // Commit transaction
      await session.commitTransaction();
      
      return res.status(200).json({
        message: conflictUser ? 
          `Đã chuyển mã Affiliate từ ${conflictUser.email} sang ${currentUser.email}` : 
          "Thêm mã Affiliate thành công",
        user: {
          _id: currentUser._id,
          email: currentUser.email,
          firstname: currentUser.firstname,
          lastname: currentUser.lastname,
          managedAffiliateIds: currentUser.managedAffiliateIds
        },
        affiliate: {
          _id: affiliate._id,
          name: affiliate.name,
          affiliateId: affiliate.affiliateId,
          managedBy: affiliate.managedBy
        },
        previousOwner: conflictUser ? {
          _id: conflictUser._id,
          email: conflictUser.email,
          firstname: conflictUser.firstname,
          lastname: conflictUser.lastname
        } : null
      });
      
    } catch (transactionError) {
      // Rollback transaction nếu có lỗi
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error("Lỗi khi thêm mã Affiliate:", error);
    
    // Xử lý lỗi validation từ mongoose middleware
    if (error.message && error.message.includes("đã được gán cho user khác")) {
      return res.status(403).json({ message: error.message });
    }
    
    if (error.message && error.message.includes("không tồn tại")) {
      return res.status(404).json({ message: error.message });
    }
    
    return res.status(500).json({ 
      message: "Lỗi server khi thêm mã Affiliate",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
const getUserStatus = async (req, res) => {
  const { id } = req.params; // Lấy id từ tham số URL

  try {
    const user = await User.findById(id); // Tìm người dùng theo ID

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "User found",
      data: {
        _id: user._id,
        status: user.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Server error",
      error: error.message,
    });
  }
};
const createUser = async (req, res) => {
  try {
    const {
      email,
      firstname,
      lastname,
      password,
      status,
      region,
      province,
      employeeCode,
      profileDetails,
      team,
      role,
      managedBy
    } = req.body;

    // ✅ Validate
    if (!email || !firstname || !lastname || !password) {
      return res.status(400).json({
        message: "Missing required fields: email, firstname, lastname, password.",
      });
    }

    // ✅ Check email tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ DEFAULT VALUES
    const DEFAULT_ROLE = "69df101f29f96a3dbd215a19";
    const DEFAULT_MANAGER = "6778b859f7d1852940fd9d7c";

    // ✅ Create user
    const user = new User({
      email,
      firstname,
      lastname,
      password: hashedPassword,

      // 🔥 Ưu tiên FE truyền, không có thì dùng default
      role: role || DEFAULT_ROLE,
      managedBy: managedBy || DEFAULT_MANAGER,

      // 🔥 status mặc định active
      status: status || "active",

      region,
      province,
      employeeCode,
      profileDetails,
      team,
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully!",
      data: {
        _id: user._id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
        managedBy: user.managedBy,
        status: user.status,
      },
    });

  } catch (error) {
    res.status(500).json({
      message: "Error creating user",
      error: error.message,
    });
  }
};

const editUserRoleAndManager = async (req, res) => {
  try {
    const { userId } = req.params; // ID của user cần chỉnh sửa
    const { role, managedBy, requesterId } = req.body; // requesterId: ID của người thực hiện yêu cầu

    // Xác thực người thực hiện yêu cầu
    const requester = await User.findById(requesterId).populate("role");
    if (
      !requester ||
      !["Admin", "KTT Sale Manager", "KTT Sale Team Leader"].includes(
        requester.role?.name
      )
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện hành động này." });
    }

    // Tìm user cần chỉnh sửa
    const userToEdit = await User.findById(userId);
    if (!userToEdit) {
      return res.status(404).json({ message: "User không tồn tại." });
    }

    // Kiểm tra nếu role được cung cấp
    if (role) {
      const roleData = await Role.findById(role);
      if (!roleData) {
        return res.status(400).json({ message: "Vai trò không hợp lệ." });
      }

      const roleName = roleData.name;

      // Logic tự động kiểm tra và tạo mã nhân viên
      const validRoles = [
        "KTT Sale Manager",
        "KTT Sale Team Leader",
        "KTT User",
      ];
      if (validRoles.includes(roleName)) {
        const roleMapping = {
          "KTT Sale Manager": "KTSTH",
          "KTT Sale Team Leader": "KTSTL",
          "KTT User": "KTSTM",
        };

        const rolePrefix = roleMapping[roleName];

        // Tìm user cuối cùng với mã nhân viên có prefix tương tự
        const lastUser = await User.findOne({
          employeeCode: new RegExp(`^${rolePrefix}_`),
        }).sort({ employeeCode: -1 });

        let lastIncrement = 0;
        if (lastUser) {
          const match = lastUser.employeeCode.match(/_(\d+)$/);
          if (match) lastIncrement = parseInt(match[1], 10);
        }

        // Tạo mã nhân viên mới
        if (roleName === "KTT Sale Manager") {
          userToEdit.employeeCode = `${rolePrefix}_${lastIncrement + 1}`;
        } else {
          userToEdit.employeeCode = `${rolePrefix}_${(lastIncrement + 1)
            .toString()
            .padStart(4, "0")}`;
        }
      }

      // Logic cho từng vai trò
      if (roleName === "Admin" || roleName === "KTT Sale Manager") {
        // Nếu là Admin hoặc KTT Sale Manager, managedBy phải là null
        userToEdit.managedBy = null;
        userToEdit.status = "active"; // Trạng thái active cho Admin hoặc KTT Sale Manager
      }

      if (roleName === "KTT Sale Team Leader") {
        // Nếu là KTT Sale Team Leader, tạo team mới
        const newTeam = new Team({
          name: `${userToEdit.firstname}'s Team`,
          leadId: userToEdit._id,
          members: [],
          lead: requesterId, // managedBy là người quản lý (Admin hoặc KTT Sale Manager)
        });
        await newTeam.save();
        userToEdit.managedBy = requesterId;
        userToEdit.status = "active"; // Trạng thái active cho KTT Sale Team Leader
      }

      if (roleName === "KTT User") {
        // Nếu là KTT User, managedBy phải là leadId của team
        const team = await Team.findOne({ leadId: managedBy });
        if (!team) {
          return res
            .status(400)
            .json({ message: "Team không hợp lệ hoặc không tồn tại." });
        }

        // Thêm user vào danh sách members của team
        team.members.push(userToEdit._id);
        await team.save();

        userToEdit.managedBy = managedBy;
        userToEdit.status = userToEdit.status || "pending approval"; // Giữ trạng thái cũ hoặc là pending approval
      }

      // Cập nhật role
      userToEdit.role = role;
    }

    // Lưu các thay đổi
    const updatedUser = await userToEdit.save();

    res.status(200).json({
      message: "Role, managedBy, và status đã được chỉnh sửa thành công.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Lỗi hệ thống.", error: error.message });
  }
};

const getPendingUsers = async (req, res) => {
  try {
    const { requesterId, startDate, endDate } = req.query; // Nhận ngày bắt đầu và kết thúc từ query

    // Xác thực người gửi yêu cầu
    const currentUser = await User.findById(requesterId).populate("role");
    if (
      !currentUser ||
      !["Admin", "KTT Sale Manager"].includes(currentUser.role?.name)
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền truy cập danh sách này." });
    }

    // Tạo điều kiện lọc ngày nếu có startDate và endDate
    const filterConditions = {};
    if (startDate && endDate) {
      filterConditions.createdAt = {
        $gte: new Date(startDate), // Ngày bắt đầu
        $lte: new Date(endDate), // Ngày kết thúc
      };
    }

    // Tìm tối đa 45 người dùng mới nhất, sắp xếp theo updatedAt trước, sau đó là createdAt
    const latestUsers = await User.find(filterConditions) // Áp dụng điều kiện lọc
      .sort({ updatedAt: -1, createdAt: -1 }) // Sắp xếp theo updatedAt, sau đó createdAt
      .limit(45) // Giới hạn chỉ lấy 45 kết quả
      .populate("role managedBy"); // Lấy thêm thông tin role và managedBy

    // Lấy danh sách team để kiểm tra thành viên
    const teams = await Team.find().populate("members");

    // Lọc các người dùng có role là "KTT User" và lấy thông tin team
    const result = latestUsers.map((user) => {
      let teamName = null;

      // Nếu role là "KTT User", tìm tên team từ các teams
      if (user.role?.name === "KTT User") {
        // Duyệt qua các team để tìm team mà user là thành viên
        teams.forEach((team) => {
          if (
            team.members.some(
              (member) => member._id.toString() === user._id.toString()
            )
          ) {
            teamName = team.name; // Lấy tên team nếu user là thành viên
          }
        });
      }

      return {
        ...user.toObject(), // Chuyển đối tượng User thành đối tượng JavaScript
        teamName, // Thêm tên team vào dữ liệu trả về
      };
    });

    res.status(200).json({
      message: "Danh sách người dùng mới nhất.",
      data: result,
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Lỗi hệ thống.", error: error.message });
  }
};

const updatePartnershipStatus = async (req, res) => {
  try {
    const { teamId } = req.params; // Get teamId from URL params
    const { isPartnership } = req.body; // Get isPartnership from request body

    // Find team by teamId
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Update the partnership status
    team.isPartnership = isPartnership;

    // Save the updated team
    await team.save();

    res
      .status(200)
      .json({ message: "Partnership status updated successfully", team });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { requesterId, email, phone } = req.query; // Lấy thông tin từ query params

    // Xác thực người gửi yêu cầu
    const currentUser = await User.findById(requesterId).populate("role");
    if (
      !currentUser ||
      !["Admin", "KTT Sale Team Leader"].includes(currentUser.role?.name)
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền truy cập danh sách này." });
    }

    // Kiểm tra đầu vào tìm kiếm
    if (!email && !phone) {
      return res.status(400).json({
        message:
          "Vui lòng cung cấp ít nhất một trong các thông tin sau: email hoặc số điện thoại.",
      });
    }

    // Tìm kiếm user chưa có vai trò, mã nhân viên và có trạng thái "pending approval"
    const query = {
      role: null, // Chưa có vai trò
      employeeCode: null, // Không có mã nhân viên
      status: "pending approval", // Trạng thái đang chờ duyệt
    };

    if (email) query.email = email;
    if (phone) query["profileDetails.phone"] = phone;

    // Tìm kiếm user thỏa mãn
    const matchingUsers = await User.find(query)
      .sort({ createdAt: -1 }) // Sắp xếp từ mới nhất đến cũ nhất
      .populate("role managedBy"); // Lấy thêm thông tin role và managedBy nếu cần

    res.status(200).json({
      message: "Danh sách người dùng tìm kiếm.",
      data: matchingUsers,
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Lỗi hệ thống.", error: error.message });
  }
};
const approveUser = async (req, res) => {
  const { userId } = req.params;

  try {
    // Tìm user bằng userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }

    // Kiểm tra trạng thái hiện tại của user
    if (user.status !== "pending approval") {
      return res.status(400).json({
        message: `Không thể phê duyệt người dùng vì trạng thái hiện tại là: ${user.status}.`,
      });
    }

    // Cập nhật trạng thái sang "active"
    user.status = "active";
    await user.save();

    return res.status(200).json({
      message: "Người dùng đã được phê duyệt thành công.",
      data: user,
    });
  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({ message: "Lỗi hệ thống.", error: error.message });
  }
};

module.exports = {
  createAccount,
  getUserStatus,
  createUser,
  editUserRoleAndManager,
  getPendingUsers,
  searchUsers,
  approveUser,
  updatePartnershipStatus,
  addAffiliateToProfile,
};
