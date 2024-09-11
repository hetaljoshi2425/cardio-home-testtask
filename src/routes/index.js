const express = require("express");
const apiController = require("../controllers/apiController");
const { getProfile } = require("../middleware/getProfile");

const route = express.Router();

route.get("/contracts/:id", getProfile, apiController.getContractsById);
route.get("/contracts", getProfile, apiController.getContracts);
route.get("/jobs/unpaid", getProfile, apiController.getUnpaidJobs);
route.post("/jobs/:job_id/pay", getProfile, apiController.jobPayment);
route.post(
  "/balances/deposit/:userId",
  getProfile,
  apiController.depositAmount
);
route.get("/admin/best-profession", apiController.bestProfessions);
route.get("/admin/best-clients", apiController.bestClients);

module.exports = route;
