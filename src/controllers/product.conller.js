const Product = require("../models/product.model"); // Đảm bảo đường dẫn đúng
const User = require("../models/user.model");

const findProductsByCategoryAndName = async (req, res) => {
  try {
    const { query } = req.query; // Lấy từ khóa tìm kiếm từ query string

    let searchConditions = { status: { $ne: "unavailable" } }; // Bắt đầu với điều kiện không lấy sản phẩm "unavailable"

    if (query) {
      searchConditions.name = { $regex: query, $options: "i" }; // Tìm kiếm theo tên sản phẩm
    }

    // Tìm kiếm sản phẩm dựa trên điều kiện
    const products = await Product.find(searchConditions);

    if (!products || products.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy sản phẩm nào với thông tin đã cung cấp.",
      });
    }

    return res.status(200).json(products); // Trả về danh sách sản phẩm
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Lỗi máy chủ khi tìm kiếm sản phẩm." });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const { user_id } = req.params; // Nhận user_id từ params

    if (!user_id) {
      return res.status(400).json({ message: "Vui lòng cung cấp user_id." });
    }

    // Tìm thông tin người dùng từ database
    const user = await User.findById(user_id).populate("role");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    // Kiểm tra vai trò của người dùng
    if (user.role.name !== "Admin" && user.role.name !== "KTT Sale Manager") {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền truy cập vào tài nguyên này." });
    }

    // Tìm tất cả sản phẩm
    const products = await Product.find();

    if (!products || products.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm nào." });
    }

    // Trả về danh sách sản phẩm
    return res.status(200).json(products);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Lỗi máy chủ khi lấy danh sách sản phẩm." });
  }
};
const addVoucherToProduct = async (req, res) => {
  const { productId } = req.params;
  const voucherData = req.body;

  try {
    // Tìm sản phẩm theo ID
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Thêm voucher mới vào mảng vouchers
    product.vouchers.push(voucherData);

    // Lưu sản phẩm đã cập nhật
    await product.save();

    res.status(200).json({ message: "Đã thêm voucher thành công", product });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi thêm voucher", error });
  }
};
const createProduct = async (req, res) => {
  try {
    const { name, category, price, vouchers } = req.body;

    // Chuyển giá trị price thành số nếu cần
    const parsedPrice = parseFloat(price);

    // Lấy thông tin createdBy từ req.user nếu có (nếu bạn sử dụng xác thực người dùng)
    const createdBy = req.user ? req.user.id : null;

    // Tạo sản phẩm mới mà không truyền productCode, vì mã này sẽ được tự động tạo trong middleware
    const newProduct = new Product({
      name,
      category,
      price: parsedPrice,
      vouchers,
      createdBy
    });

    // Lưu sản phẩm vào cơ sở dữ liệu
    await newProduct.save();

    // Trả về thông báo thành công và thông tin sản phẩm mới tạo
    res.status(201).json({
      message: 'Sản phẩm đã được tạo thành công!',
      product: newProduct
    });
  } catch (error) {
    console.error('Lỗi khi tạo sản phẩm:', error); // Log lỗi chi tiết
    res.status(500).json({ message: 'Lỗi khi tạo sản phẩm', error });
  }
};


module.exports = {
  findProductsByCategoryAndName,
  getAllProducts,
  addVoucherToProduct,
  createProduct,
};
