const { sequelize, Contract } = require("../model");
const { Op } = require("sequelize");

const getContractsById = async (req, res) => {
  const { Contract } = req.app.get("models");
  const profileId = req.profile.id;
  const { id } = req.params;

  try {
    const contract = await Contract.findOne({
      where: {
        id,
        [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
      },
    });

    if (!contract) {
      return res.status(404).json({
        message: "No Contract found for this user",
      });
    }
    return res.json(contract);
  } catch (error) {
    return res.status(500).send({
      message: "Internal server error",
      error: error?.message,
    });
  }
};

const getContracts = async (req, res) => {
  const { Contract } = req.app.get("models");
  const profileId = req.profile.id;

  try {
    const contracts = await Contract.findAll({
      where: {
        [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
        status: {
          [Op.not]: "terminated",
        },
      },
    });

    if (!contracts) {
      return res.status(404).json({
        message: "No Contracts found",
      });
    }

    return res.json(contracts);
  } catch (error) {
    return res.status(500).send({
      message: "Internal server error",
      error: error?.message,
    });
  }
};

const getUnpaidJobs = async (req, res) => {
  const { Contract, Job } = req.app.get("models");
  const profileId = req.profile.id;
  try {
    const activeContracts = await Contract.findAll({
      where: {
        [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
        status: "in_progress", // if active contracts means new and in_progress both then this condition needs to change
      },
      attributes: ["id"],
    });

    if (!activeContracts) {
      return res.status(404).json({
        message: "No Active contracts found for this user",
      });
    }

    const activecontractsId = activeContracts.map((contract) => contract.id);

    const unpaidJobs = await Job.findAll({
      where: {
        ContractId: {
          [Op.in]: activecontractsId,
        },
        paid: {
          [Op.not]: true, // In database there is no key related to paid : false so need to add this reverse condition
        },
      },
    });

    if (!unpaidJobs) {
      return res.status(404).json({
        message: "No unpaid jobs found",
      });
    }

    return res.status(200).json(unpaidJobs);
  } catch (error) {
    return res.status(500).send({
      message: "Internal server error",
      error: error?.message,
    });
  }
};

const jobPayment = async (req, res) => {
  const { Job, Profile, Contract } = req.app.get("models");
  const { job_id } = req.params;
  const clientProfileId = req.profile.id;
  const transaction = await sequelize.transaction();

  try {
    if (!job_id) {
      return res.status(404).send("Job_id is required field");
    }
    const job = await Job.findOne({
      where: {
        id: job_id,
      },
      include: {
        model: Contract,
        include: [
          {
            model: Profile,
            as: "Contractor",
          },
          {
            model: Profile,
            as: "Client",
          },
        ],
      },
    });

    if (!job) {
      return res.status(404).send("Job not found");
    }

    const contractData = job.Contract;
    const clientData = contractData?.Client;
    const contractorData = contractData?.Contractor;

    if (clientProfileId !== clientData?.id) {
      return res.status(401).send("unauthorized access for this job");
    }

    // There is a field in Job table called paid. So, I think it's for ensuring that client doesn't paid for same job again.
    // So that's why i am adding this validation here

    if (job.paid) {
      return res.status(400).send("You have already paid for this job");
    }

    if (clientData.balance < job.price) {
      return res.status(400).send("insufficient balance");
    }

    // Updating Client balance

    await Profile.update(
      {
        balance: clientData.balance - job.price,
      },
      {
        where: {
          id: clientData.id,
        },
      },
      {
        transaction: transaction,
      }
    );

    // Updating contractor balance

    await Profile.update(
      {
        balance: contractorData.balance + job.price,
      },
      {
        where: {
          id: contractorData.id,
        },
      },
      {
        transaction: transaction,
      }
    );

    // also need to update job to paid

    await Job.update(
      {
        paid: true,
        paymentDate: new Date(),
      },
      {
        where: {
          id: job.id,
        },
      },
      {
        transaction: transaction,
      }
    );

    await transaction.commit(); // commit transaction

    return res.status(200).send("Payment for job successfully completed");
  } catch (error) {
    await transaction.rollback();
    return res.status(500).send({
      message: "Internal server error",
      error: error?.message,
    });
  }
};

const depositAmount = async (req, res) => {
  const { Job, Profile, Contract } = req.app.get("models");
  const { depositAmount } = req.body;
  const { userId } = req.params;
  const clientProfileId = req.profile.id;

  try {
    const user = await Profile.findOne({
      where: {
        id: userId,
        type: "client",
      },
    });

    if (!user) return res.status(404).send("Client not found");

    if (clientProfileId !== user.id) {
      return res.status(401).send("Unauthorized access");
    }

    // Find all contracts so based on that we can find total of the payable jobs amount

    const contracts = await Contract.findAll({
      where: {
        clientId: user.id,
        status: "in_progress",
      },
      include: {
        model: Job,
        as: "Jobs",
        where: {
          paid: false,
        },
        attributes: ["price"],
      },
      attributes: ["id"],
    });

    let totalDueAmount = 0;

    contracts.forEach((contract) => {
      contract.Jobs.forEach((job) => {
        totalDueAmount += job.price;
      });
    });

    const limitDepositAmount = totalDueAmount * 0.25;

    if (depositAmount > limitDepositAmount) {
      return res
        .status(400)
        .send("Deposit amount exceeds 25% of total unpaid jobs");
    }

    await Profile.update(
      {
        balance: user.balance + depositAmount,
      },
      {
        where: {
          id: user.id,
        },
      }
    );

    return res.status(200).send("Deposit successful");
  } catch (error) {
    return res.status(500).send({
      message: "Internal server error",
      error: error?.message,
    });
  }
};

const bestProfessions = async (req, res) => {
  const { start, end } = req.query;
  const { Profile, Job, Contract } = req.app.get("models");

  try {
    if (!start || !end) {
      return res.status(400).send("start and end dates are required");
    }

    // if dates are not coming properly then it needs to convert in iso format

    const jobs = await Job.findAll({
      where: {
        paid: true,
        paymentDate: {
          [Op.between]: [start, end],
        },
      },
      include: {
        model: Contract,
        include: {
          model: Profile,
          as: "Contractor",
        },
      },
    });

    // we need to find all professions earning first to check which profession is getting higher paid
    const earningOfProfessions = {};

    jobs.forEach((job) => {
      const contractor = job.Contract.Contractor;
      if (contractor) {
        const profession = contractor.profession;
        if (!earningOfProfessions[profession]) {
          earningOfProfessions[profession] = 0;
        }
        earningOfProfessions[profession] += parseFloat(job.price);
      }
    });

    // here we can check all earning values in this variable for getting max value of earning
    let bestProfession = null;
    let maxEarnings = 0;

    for (const [profession, earnings] of Object.entries(earningOfProfessions)) {
      if (earnings > maxEarnings) {
        maxEarnings = earnings;
        bestProfession = profession;
      }
    }

    return res.status(200).send({
      profession: bestProfession,
      earnings: maxEarnings,
    });
  } catch (error) {
    return res.status(500).send({
      message: "Internal server error",
      error: error?.message,
    });
  }
};

const bestClients = async (req, res) => {
  const { start, end, limit = 2 } = req.query;
  const { Profile, Job, Contract } = req.app.get("models");

  if (!start || !end) {
    return res.status(400).send("Start and end dates are required");
  }

  try {
    const bestClients = await Job.findAll({
      attributes: [[sequelize.fn("SUM", sequelize.col("price")), "paid"]],
      where: {
        paid: true,
        paymentDate: {
          [Op.between]: [start, end],
        },
      },
      include: [
        {
          model: Contract,
          attributes: ["id"],
          include: [
            {
              model: Profile,
              as: "Client",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
        },
      ],
      group: ["Contract.ClientId", "Contract.Client.id"],
      order: [[sequelize.literal("paid"), "DESC"]],
      limit: limit,
    });

    const response = bestClients.map((client) => {
      const clientProfile = client.Contract.Client;

      return {
        id: clientProfile.id,
        fullName: clientProfile.firstName + " " + clientProfile.lastName,
        paid: client.paid,
      };
    });

    return res.status(200).send(response);
  } catch (error) {
    return res.status(500).send({
      message: "Internal server error",
      error: error?.message,
    });
  }
};

module.exports = {
  getContractsById,
  getContracts,
  getUnpaidJobs,
  depositAmount,
  jobPayment,
  bestClients,
  bestProfessions,
};
