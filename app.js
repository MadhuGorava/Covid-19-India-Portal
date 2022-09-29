const express = require("express");
const Express = express();
Express.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    Express.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertDbIntoResponse = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.header["authentication"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "abcdefg", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

Express.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "abcdefg");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

Express.get("/states/", authenticateToken, async (request, response) => {
  const stateResponseQuery = `SELECT * FROM state`;
  const stateDetails = await db.all(stateResponseQuery);
  response.send(convertDbIntoResponse(stateDetails));
});

Express.get(
  "/states/:stateId/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const stateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`;
    const stateDetails = await db.get(stateQuery);
    response.send(convertDbIntoResponse(stateDetails));
  }
);

Express.post("/districts/", authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths) VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`;
  await db.run(districtQuery);
  response.send("District SuccessFully Added");
});

Express.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `SELECT * FROM district WHERE district_id = ${districtId}`;
    const districtDetails = await db.get(districtQuery);
    response.send(convertDbIntoResponse(districtDetails));
  }
);

Express.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id = ${districtId}`;
    const getDeleteDistrict = await db.get(deleteQuery);
    response.send("District Removed");
  }
);

Express.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district SET (district_name = '${districtName}', state_id = ${stateId}, cases = ${cases}, cured = ${cured}, active = ${active}, deaths = ${deaths}) WHERE district_id = ${districtId}`;
    const getUpdate = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

Express.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getMovieDetailQuery = `select sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths from district where state_id = ${stateId}`;
    const movieDbResponse = await db.get(getMovieDetailQuery);
    response.send(movieDbResponse);
  }
);

module.exports = Express;
