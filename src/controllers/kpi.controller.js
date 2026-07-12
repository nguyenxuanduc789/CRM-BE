const KPI = require("../models/kpi.model");
const User = require("../models/user.model");
const Team = require("../models/team.model");
const moment = require("moment");
// Tạo KPI mới
exports.createKPI = async (req, res) => {
  try {
    const { user, assignedBy, target, startDate, endDate } = req.body;

    // Kiểm tra người giao KPI (assignedBy)
    const creator = await User.findById(assignedBy).populate("role");
    if (!creator) {
      return res.status(404).json({ message: "Người tạo KPI không tồn tại." });
    }

    // Kiểm tra vai trò của người giao KPI
    const creatorRole = creator.role?.name;
    if (!creatorRole) {
      return res
        .status(403)
        .json({ message: "Người tạo KPI không có vai trò hợp lệ." });
    }

    // Kiểm tra người được giao KPI (user)
    const assignedUser = await User.findById(user).populate("role");
    if (!assignedUser) {
      return res.status(404).json({ message: "Người nhận KPI không tồn tại." });
    }

    // Kiểm tra nếu đã tồn tại KPI nào cho người nhận (user) trong khoảng thời gian
    const overlappingKPI = await KPI.findOne({
      user,
      $or: [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) },
        },
      ],
    });

    if (overlappingKPI) {
      return res.status(403).json({
        message:
          "KPI đã tồn tại trong khoảng thời gian này. Vui lòng đợi KPI hết hạn trước khi tạo mới.",
      });
    }

    if (creatorRole === "KTT Sale Manager") {
      // Nếu người tạo KPI là Manager
      if (assignedUser.role?.name !== "KTT Sale Team Leader") {
        return res
          .status(403)
          .json({ message: "Chỉ có thể giao KPI cho Lead." });
      }

      // Tạo KPI cho Lead
      const newKPI = new KPI({
        user, // Lead là người nhận
        assignedBy, // Manager là người giao
        target,
        startDate,
        endDate,
      });

      await newKPI.save();
      return res.status(201).json({
        message: "KPI đã được tạo thành công cho Lead.",
        kpi: newKPI,
      });
    } else if (creatorRole === "KTT Sale Team Leader") {
      // Nếu người tạo KPI là Lead
      const team = await Team.findOne({ leadId: assignedBy });
      if (!team || !team.members.includes(user)) {
        return res
          .status(403)
          .json({ message: "Người nhận KPI không thuộc team của bạn." });
      }

      // Lấy KPI của Lead (được giao bởi Manager)
      const leadKPI = await KPI.findOne({ user: assignedBy });
      if (!leadKPI) {
        return res
          .status(403)
          .json({ message: "Bạn chưa được giao KPI từ Manager." });
      }

      // Kiểm tra thời gian phân KPI nằm trong khoảng KPI của Lead
      if (
        new Date(startDate) < new Date(leadKPI.startDate) ||
        new Date(endDate) > new Date(leadKPI.endDate)
      ) {
        return res.status(403).json({
          message:
            "Thời gian phân KPI phải nằm trong khoảng thời gian KPI được giao bởi Manager.",
        });
      }

      // Lấy tất cả KPI của các thành viên trong team mà Lead đã giao
      const existingKPIs = await KPI.find({ assignedBy: assignedBy });
      const currentTotal = existingKPIs.reduce(
        (sum, kpi) => sum + kpi.target,
        0
      );

      if (currentTotal + target > leadKPI.target) {
        return res.status(403).json({
          message:
            "Tổng target phân chia cho các thành viên không được vượt quá target của bạn.",
        });
      }

      // Tạo KPI cho User
      const newKPI = new KPI({
        user, // Member là người nhận
        assignedBy, // Lead là người giao
        target,
        startDate,
        endDate,
      });

      await newKPI.save();
      return res.status(201).json({
        message: "KPI đã được tạo thành công cho User.",
        kpi: newKPI,
      });
    } else {
      return res.status(403).json({ message: "Bạn không có quyền tạo KPI." });
    }
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      message: "Đã xảy ra lỗi khi tạo KPI.",
      error: error.message,
    });
  }
};
// exports.getManagedUsers = async (req, res) => {
//   try {
//     const userId = req.query.user_id; // ID người yêu cầu báo cáo
//     const currentMonth = req.query.month || moment().month() + 1; // Tháng hiện tại hoặc được cung cấp
//     const currentYear = req.query.year || moment().year(); // Năm hiện tại hoặc được cung cấp

//     if (!userId) {
//       return res.status(400).json({ message: "User ID is required" });
//     }

//     // Xác định khoảng thời gian đầu và cuối tháng
//     const startOfMonth = moment(`${currentYear}-${currentMonth}-01`)
//       .startOf("month")
//       .toDate();
//     const endOfMonth = moment(`${currentYear}-${currentMonth}-01`)
//       .endOf("month")
//       .toDate();

//     // Lấy thông tin người dùng đang yêu cầu
//     const user = await User.findById(userId).populate("role");

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const role = user.role.name;

//     if (role === "Admin") {
//       // Admin xem báo cáo KPI của tất cả các nhóm
//       const teams = await Team.find({ status: "active" }).populate(
//         "members lead leadId"
//       );

//       const data = await Promise.all(
//         teams.map(async (team) => {
//           const memberKPIReports = await KPI.find({
//             user: { $in: team.members.map((member) => member._id) },
//             startDate: { $gte: startOfMonth },
//             endDate: { $lte: endOfMonth },
//           });
//           const leadKPIReport = await KPI.find({
//             user: team.leadId._id,
//             startDate: { $gte: startOfMonth },
//             endDate: { $lte: endOfMonth },
//           });

//           return {
//             id: team._id,
//             teamName: team.name,
//             isPartnership: team.isPartnership,
//             manager: {
//               id: team.lead._id,
//               name: `${team.lead.firstname} ${team.lead.lastname}`,
//               email: team.lead.email,
//             },
//             leader: {
//               id: team.leadId._id,
//               name: `${team.leadId.firstname} ${team.leadId.lastname}`,
//               email: team.leadId.email,
//             },
//             users: team.members.map((member) => ({
//               id: member._id,
//               name: `${member.firstname} ${member.lastname}`,
//               email: member.email,
//             })),
//             kpis: [
//               ...memberKPIReports.map((kpi) => ({
//                 userId: kpi.user,
//                 target: kpi.target,
//                 actual: kpi.actual,
//                 startDate: kpi.startDate,
//                 endDate: kpi.endDate,
//                 status: kpi.status,
//               })),
//               ...leadKPIReport.map((kpi) => ({
//                 userId: kpi.user,
//                 target: kpi.target,
//                 actual: kpi.actual,
//                 startDate: kpi.startDate,
//                 endDate: kpi.endDate,
//                 status: kpi.status,
//               })),
//             ],
//           };
//         })
//       );

//       return res.status(200).json({
//         message: `Báo cáo KPI của tất cả các nhóm trong tháng ${currentMonth}/${currentYear}.`,
//         data,
//       });
//     } else if (role === "KTT Sale Manager") {
//       // Sale Manager xem báo cáo KPI của các nhóm mình quản lý
//       const teams = await Team.find({
//         lead: userId,
//         status: "active",
//       }).populate("members leadId");

//       const data = await Promise.all(
//         teams.map(async (team) => {
//           const memberKPIReports = await KPI.find({
//             user: { $in: team.members.map((member) => member._id) },
//             startDate: { $gte: startOfMonth },
//             endDate: { $lte: endOfMonth },
//           });
//           const leadKPIReport = await KPI.find({
//             user: team.leadId._id,
//             startDate: { $gte: startOfMonth },
//             endDate: { $lte: endOfMonth },
//           });

//           return {
//             teamName: team.name,
//             leader: {
//               id: team.leadId._id,
//               name: `${team.leadId.firstname} ${team.leadId.lastname}`,
//               email: team.leadId.email,
//             },
//             users: team.members.map((member) => ({
//               id: member._id,
//               name: `${member.firstname} ${member.lastname}`,
//               email: member.email,
//             })),
//             kpis: [
//               ...memberKPIReports.map((kpi) => ({
//                 userId: kpi.user,
//                 target: kpi.target,
//                 actual: kpi.actual,
//                 startDate: kpi.startDate,
//                 endDate: kpi.endDate,
//                 status: kpi.status,
//               })),
//               ...leadKPIReport.map((kpi) => ({
//                 userId: kpi.user,
//                 target: kpi.target,
//                 actual: kpi.actual,
//                 startDate: kpi.startDate,
//                 endDate: kpi.endDate,
//                 status: kpi.status,
//               })),
//             ],
//           };
//         })
//       );

//       return res.status(200).json({
//         message: `Báo cáo KPI của các nhóm do bạn quản lý trong tháng ${currentMonth}/${currentYear}.`,
//         data,
//       });
//     } else if (role === "KTT Sale Team Leader") {
//       // Sale Team Leader xem báo cáo KPI của các thành viên trong nhóm
//       const team = await Team.findOne({
//         leadId: userId,
//         status: "active",
//       }).populate("members");

//       if (!team) {
//         return res
//           .status(404)
//           .json({ message: "No team found for this leader." });
//       }

//       const memberKPIReports = await KPI.find({
//         user: { $in: team.members.map((member) => member._id) },
//         startDate: { $gte: startOfMonth },
//         endDate: { $lte: endOfMonth },
//       });
//       const leadKPIReport = await KPI.find({
//         user: userId,
//         startDate: { $gte: startOfMonth },
//         endDate: { $lte: endOfMonth },
//       });

//       return res.status(200).json({
//         message: `Báo cáo KPI của các thành viên trong nhóm của bạn trong tháng ${currentMonth}/${currentYear}.`,
//         data: {
//           teamName: team.name,
//           manager: {
//             id: team.lead._id,
//             name: `${team.lead.firstname} ${team.lead.lastname}`,
//             email: team.lead.email,
//           },
//           users: team.members.map((member) => ({
//             id: member._id,
//             name: `${member.firstname} ${member.lastname}`,
//             email: member.email,
//           })),
//           kpis: [
//             ...memberKPIReports.map((kpi) => ({
//               userId: kpi.user,
//               target: kpi.target,
//               actual: kpi.actual,
//               startDate: kpi.startDate,
//               endDate: kpi.endDate,
//               status: kpi.status,
//             })),
//             ...leadKPIReport.map((kpi) => ({
//               userId: kpi.user,
//               target: kpi.target,
//               actual: kpi.actual,
//               startDate: kpi.startDate,
//               endDate: kpi.endDate,
//               status: kpi.status,
//             })),
//           ],
//         },
//       });
//     } else {
//       return res
//         .status(403)
//         .json({ message: "Bạn không có quyền truy cập báo cáo KPI." });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };
exports.getManagedUsers = async (req, res) => {
  try {
    const userId = req.query.user_id; // ID người yêu cầu báo cáo
    const currentMonth = req.query.month
      ? parseInt(req.query.month, 10)
      : new Date().getMonth() + 1; // Tháng hiện tại hoặc được cung cấp
    const currentYear = req.query.year
      ? parseInt(req.query.year, 10)
      : new Date().getFullYear(); // Năm hiện tại hoặc được cung cấp

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Kiểm tra xem tháng và năm có hợp lệ không
    if (currentMonth < 1 || currentMonth > 12) {
      return res.status(400).json({
        message: "Invalid month value. It should be between 1 and 12",
      });
    }

    // Xử lý ngày bắt đầu và ngày kết thúc của tháng
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1)); // Ngày đầu tháng
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0)); // Ngày cuối tháng

    // Lấy thông tin người dùng yêu cầu
    const user = await User.findById(userId).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.role.name;
    let data = [];

    // Xử lý theo vai trò người dùng
    switch (role) {
      case "Admin":
        data = await getAdminData(startOfMonth, endOfMonth);
        return res.status(200).json({
          message: `Báo cáo KPI của tất cả các nhóm trong tháng ${currentMonth}/${currentYear}.`,
          data,
        });

      case "KTT Sale Manager":
        data = await getSaleManagerData(userId, startOfMonth, endOfMonth);
        return res.status(200).json({
          message: `Báo cáo KPI của các nhóm do bạn quản lý trong tháng ${currentMonth}/${currentYear}.`,
          data,
        });

      case "KTT Sale Team Leader":
        data = await getSaleTeamLeaderData(userId, startOfMonth, endOfMonth);
        return res.status(200).json({
          message: `Báo cáo KPI của các thành viên trong nhóm của bạn trong tháng ${currentMonth}/${currentYear}.`,
          data,
        });

      default:
        return res.status(403).json({
          message: "Bạn không có quyền truy cập báo cáo KPI.",
        });
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// Hàm lấy dữ liệu cho Admin
async function getAdminData(startOfMonth, endOfMonth) {
  const teams = await Team.find({ status: "active" }).populate(
    "members lead leadId"
  );
  return await Promise.all(
    teams.map(async (team) => {
      const memberKPIReports = await KPI.find({
        user: { $in: team.members.map((member) => member._id) },
        startDate: { $gte: startOfMonth },
        endDate: { $lte: endOfMonth },
      });
      const leadKPIReport = await KPI.find({
        user: team.leadId._id,
        startDate: { $gte: startOfMonth },
        endDate: { $lte: endOfMonth },
      });
      return formatTeamData(team, memberKPIReports, leadKPIReport);
    })
  );
}

// Hàm lấy dữ liệu cho Sale Manager
async function getSaleManagerData(userId, startOfMonth, endOfMonth) {
  const teams = await Team.find({
    lead: userId,
    status: "active",
  }).populate("members leadId");
  return await Promise.all(
    teams.map(async (team) => {
      const memberKPIReports = await KPI.find({
        user: { $in: team.members.map((member) => member._id) },
        startDate: { $gte: startOfMonth },
        endDate: { $lte: endOfMonth },
      });
      const leadKPIReport = await KPI.find({
        user: team.leadId._id,
        startDate: { $gte: startOfMonth },
        endDate: { $lte: endOfMonth },
      });
      return formatTeamData(team, memberKPIReports, leadKPIReport);
    })
  );
}

// Hàm lấy dữ liệu cho Team Leader
async function getSaleTeamLeaderData(userId, startOfMonth, endOfMonth) {
  const team = await Team.findOne({
    leadId: userId,
    status: "active",
  }).populate("members");
  if (!team) {
    throw new Error("No team found for this leader.");
  }
  const memberKPIReports = await KPI.find({
    user: { $in: team.members.map((member) => member._id) },
    startDate: { $gte: startOfMonth },
    endDate: { $lte: endOfMonth },
  });
  const leadKPIReport = await KPI.find({
    user: userId,
    startDate: { $gte: startOfMonth },
    endDate: { $lte: endOfMonth },
  });
  return formatTeamData(team, memberKPIReports, leadKPIReport);
}

// Hàm chuẩn hóa dữ liệu đội
function formatTeamData(team, memberKPIReports, leadKPIReport) {
  return {
    teamName: team.name,
    leader: {
      id: team.leadId._id,
      name: `${team.leadId.firstname} ${team.leadId.lastname}`,
      email: team.leadId.email,
    },
    users: team.members.map((member) => ({
      id: member._id,
      name: `${member.firstname} ${member.lastname}`,
      email: member.email,
    })),
    kpis: [
      ...memberKPIReports.map((kpi) => ({
        userId: kpi.user,
        target: kpi.target,
        actual: kpi.actual,
        startDate: kpi.startDate,
        endDate: kpi.endDate,
        status: kpi.status,
      })),
      ...leadKPIReport.map((kpi) => ({
        userId: kpi.user,
        target: kpi.target,
        actual: kpi.actual,
        startDate: kpi.startDate,
        endDate: kpi.endDate,
        status: kpi.status,
      })),
    ],
  };
}

exports.getKPIsByRole = async (req, res) => {
  try {
    const { user_id, month, year } = req.query;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // Tìm thông tin người dùng
    const user = await User.findById(user_id).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const role = user.role.name; // Vai trò của người dùng
    const selectedMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    const selectedYear = year ? parseInt(year) : new Date().getFullYear();

    // Lọc KPI theo tháng và năm
    const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const endOfMonth = new Date(selectedYear, selectedMonth, 0);

    let kpiData;

    if (role === "Admin" || role === "KTT Sale Manager") {
      // Admin & KTT Sale Manager: Xem tất cả KPI
      kpiData = await KPI.find({
        startDate: { $lte: endOfMonth },
        endDate: { $gte: startOfMonth },
      }).populate("user", "firstname lastname email");
    } else if (role === "KTT Sale Team Leader") {
      // KTT Sale Team Leader: Xem KPI của chính họ
      kpiData = await KPI.find({
        user: user_id,
        startDate: { $lte: endOfMonth },
        endDate: { $gte: startOfMonth },
      }).populate("user", "firstname lastname email");
    } else if (role === "KTT User") {
      // KTT User: Xem KPI cá nhân
      kpiData = await KPI.find({
        user: user_id,
        startDate: { $lte: endOfMonth },
        endDate: { $gte: startOfMonth },
      }).populate("user", "firstname lastname email");
    } else if (role === "KTT Partner") {
      // KTT Partner: Xem KPI của chính họ
      kpiData = await KPI.find({
        user: user_id,
        startDate: { $lte: endOfMonth },
        endDate: { $gte: startOfMonth },
      }).populate("user", "firstname lastname email");
    } else {
      return res
        .status(403)
        .json({ message: "You do not have permission to view this data." });
    }

    return res.status(200).json({
      message: `KPI data for ${role}`,
      data: kpiData.map((kpi) => ({
        id: kpi._id,
        user: {
          id: kpi.user._id,
          name: `${kpi.user.firstname} ${kpi.user.lastname}`,
          email: kpi.user.email,
        },
        target: kpi.target,
        actual: kpi.actual,
        startDate: kpi.startDate,
        endDate: kpi.endDate,
        status: kpi.status,
      })),
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error.", error: error.message });
  }
};
