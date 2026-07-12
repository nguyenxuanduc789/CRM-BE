const moment = require("moment");

// Mocking the check logic
const testLogic = (startDateStr, todayStr) => {
    const startDate = moment(startDateStr, "YYYY-MM-DD");
    const today = moment(todayStr, "YYYY-MM-DD");
    const expiryDate = startDate.clone().add(1, 'year');
    const daysUntilExpiry = expiryDate.diff(today, 'days');
    
    console.log(`Purchase Date: ${startDate.format("DD/MM/YYYY")}`);
    console.log(`Today: ${today.format("DD/MM/YYYY")}`);
    console.log(`Expiry Date: ${expiryDate.format("DD/MM/YYYY")}`);
    console.log(`Days until expiry: ${daysUntilExpiry}`);
    
    if (daysUntilExpiry === 30) console.log(">>> SEND: 1 Month Reminder");
    else if (daysUntilExpiry === 10) console.log(">>> SEND: 10 Days Reminder");
    else if (daysUntilExpiry === 1) console.log(">>> SEND: 1 Day Reminder");
    else console.log("No reminder today");
    console.log("-----------------------------------");
};

console.log("Test Case 1: 1 month before");
testLogic("2026-05-16", "2027-04-16");

console.log("Test Case 2: 10 days before");
testLogic("2026-05-16", "2027-05-06");

console.log("Test Case 3: 1 day before");
testLogic("2026-05-16", "2027-05-15");

console.log("Test Case 4: No reminder");
testLogic("2026-05-16", "2026-12-16");
