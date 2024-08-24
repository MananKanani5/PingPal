const mongoose = require("mongoose");
require("dotenv").config();

function mongoConnect() {
  mongoose
    .connect(process.env.MONGO_DB_URL)
    .then((response) => {
      console.log("MongoDB Connection Succeeded.");
    })
    .catch((error) => {
      console.log("Error in DB connection: " + error);
    });
}

module.exports = mongoConnect;
