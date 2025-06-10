const InstallmentPlan = require("../models/InstallmentPlan.model");

// Tạo các installment plans
async function updateInstallmentStatus(installmentId, status) {
  try {
    const installment = await InstallmentPlan.findById(installmentId);

    // Nếu trạng thái là 'paid'
    if (status === 'paid') {
      installment.status = 'paid';
      installment.amountRemaining -= installment.amountDue; // Giảm số tiền còn lại sau khi thanh toán
    } 
    // Nếu trạng thái là 'failed'
    else if (status === 'failed') {
      installment.status = 'failed';
      // Khi thất bại, giữ nguyên amountRemaining và cập nhật amountOriginal cho lần tiếp theo
      if (installment.amountRemaining > 0) {
        const nextInstallment = await InstallmentPlan.findOne({
          orderCode: installment.orderCode,
          status: 'pending',
        }).sort('createdAt');
        
        // Cập nhật amountOriginal của đợt tiếp theo
        if (nextInstallment) {
          nextInstallment.amountOriginal = installment.amountRemaining;
          await nextInstallment.save();
        }
      }
    }
    
    await installment.save();
    return installment;
  } catch (err) {
    console.error("Error updating installment status:", err);
    throw new Error("Error updating installment status");
  }
}
