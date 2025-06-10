"use strict";

const userModel = require("../user.model");

const findByEmail = async ({
  email,
  select = {
    email: 1,
    password: 1,
    role: 1,
    lastname: 1,
    firstname: 1,
    status: 1,
    employeeCode: 1,
  },
}) => {
  // Find user by email and populate the 'role' field
  const foundUser = await userModel
    .findOne({ email })
    .select(select) // Select the required fields
    .populate("role", "name") // Populate the 'role' field (this assumes role is a reference to the Role model)
    .lean(); // Return a plain JavaScript object

  return foundUser;
};

module.exports = {
  findByEmail,
};
