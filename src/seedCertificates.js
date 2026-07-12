const mongoose = require('mongoose');
const Certificate = require('./models/certificate.model');
require('dotenv').config();

const dbURI = process.env.URL_CLOUD_MONGO || "mongodb+srv://ducprokb1234:Qu8JeVkU0ztydjsY@cluster0.dsbpjbn.mongodb.net/khitam?retryWrites=true&w=majority";

const seedData = [
  {
    fullName: "Nguyễn Ngọc Mỹ Duyên",
    email: "nnmyduyen@gmail.com",
    phone: "909040303",
    address: "15 Lê Thánh Tôn, Quận 1, TP.HCM",
    courseName: "200H",
    courseCode: "K10",
    certNumber: "No: 01/YTL–K10/2022",
    issueDate: "Course from 18/07/2021 to 14/03/2022. Issued on: 14/03/2022"
  },
  {
    fullName: "HOANG THI NGOC ANH",
    email: "anhlinhhoang87@gmail.com",
    phone: "903327218",
    address: "Block C2, Chung cư Gia Hòa, đường Huy Cận, P Phước Long B, Tp Thủ Đức.",
    courseName: "200H",
    courseCode: "K10",
    certNumber: "No: 02/YTL–K10/2022",
    issueDate: "Course from 18/07/2021 to 14/03/2022. Issued on: 14/03/2022"
  },
  {
    fullName: "Trần Hoài Ngân",
    email: "quangngan2011@gmail.com",
    phone: "918291205",
    address: "Xóm 6 thôn Trung Tiến , xã Việt tiến, huyện Thạch hà, tỉnh Hà Tĩnh",
    courseName: "200H",
    courseCode: "K10",
    certNumber: "No: 03/YTL–K10/2022",
    issueDate: "Course from 18/07/2021 to 14/03/2022. Issued on: 14/03/2022"
  },
  {
    fullName: "PHAN TIEN MINH CHAU",
    email: "codie.zhu@gmail.com",
    phone: "704557232",
    address: "K43/01 Lý Thường Kiệt, Phường Thạch Thang, Quận Hải Châu, Thành phố Đà Nẵng",
    courseName: "200H",
    courseCode: "K10",
    certNumber: "No: 04/YTL–K10/2022",
    issueDate: "Course from 18/07/2021 to 14/03/2022. Issued on: 14/03/2022"
  },
  {
    fullName: "HOÀNG THỊ HẢI YẾN",
    email: "hoangthihaiyen854@gmail.com",
    phone: "362189165",
    address: "Công ty TNHH Hoysung Việt Nam, Đường N2, KCN Nhơn Trạch 5, Thị trấn Hiệp Phước, Nhơn Trạch, Đồng Nai,",
    courseName: "200H",
    courseCode: "K10",
    certNumber: "No: 05/YTL–K10/2022",
    issueDate: "Course from 18/07/2021 to 14/03/2022. Issued on: 14/03/2022"
  }
];

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log("Connected to MongoDB for seeding...");
  await Certificate.deleteMany({});
  console.log("Cleared existing certificates");
  await Certificate.insertMany(seedData);
  console.log("Inserted seed data successfully");
  mongoose.connection.close();
}).catch(err => {
  console.error("Failed to connect or seed:", err);
});
