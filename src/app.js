const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./model");
const mainRoutes = require("./routes/index");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger-output.json");

const app = express();
app.use(bodyParser.json());
app.use("/", mainRoutes);
app.set("sequelize", sequelize);
app.set("models", sequelize.models);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

module.exports = app;
