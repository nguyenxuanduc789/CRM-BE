const express = require("express");
const {
  createAccount,
  getUserStatus,
  searchUsers,
  createUser,
  editUserRoleAndManager,
  getPendingUsers,
  approveUser,
  updatePartnershipStatus,
  addAffiliateToProfile,
} = require("../../controllers/userController");
const router = express.Router();
const mockAuth = require("../mockAuth");
const authorize = require("../../middlewares/authorize");

// Route với middleware xác thực
router.post("/create-user", mockAuth, createAccount);
router.post("/profile/:userId/affiliate", addAffiliateToProfile);
router.get("/profile", authorize, (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Truy cập thành công thông tin người dùng",
    data: req.user, // Thông tin từ token
  });
});

router.post("/create-users", mockAuth, createUser);
router.patch("/users/:userId/edit-role-manager", editUserRoleAndManager);
router.get("/users/pending-approval", getPendingUsers);
router.get("/users/search", searchUsers);
router.patch("/users/:userId/approve", approveUser);
router.get("/profile/status/:id", getUserStatus);
router.put("/team/:teamId/partnership", updatePartnershipStatus);
module.exports = router;
