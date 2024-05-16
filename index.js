import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { name } from "ejs";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "postgres12345",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;
let currentUserColor = "gray";
let currentUser = "";
const DEFAULT_COLOR = "teal";

// Full Many-To-Many Table
const table = "visited_countries JOIN countries ON countries.id = visited_countries.country_id JOIN family_members ON family_members.id = visited_countries.member_id"

async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM " + table + " WHERE member_id = " + currentUserId + ";");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function checkUsers() {
  const result = await db.query("SELECT id, name, color FROM family_members ORDER BY name;");
  let users = [];
  result.rows.forEach((user) => {
    users.push(user);
  });
  return users;
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const users = await checkUsers();
  currentUserColor = users.find((user) => user.id == currentUserId).color;
  currentUser = users.find((user) => user.id == currentUserId);

  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUserColor
  });
});

app.post("/add", async (req, res) => {
  const countries = await checkVisisted();
  const users = await checkUsers();
  const inputCountry = req.body.country;
  currentUserColor = users.find((user) => user.id == currentUserId).color;
  currentUser = users.find((user) => user.id == currentUserId);

  try {
    const resultId = await db.query(
      "SELECT id FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [inputCountry.toLowerCase()]
    );

    // Confirm that valid result was found
    if(resultId.rows.length != 1){
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUserColor,
        error: `${inputCountry} Not Found In Country List! Try Again.`
      });
    } else {
      const idData = resultId.rows[0];
      const countryId = idData.id;

      try {
        let countryCode = await db.query("SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';", [inputCountry.toLowerCase()]);
        // Check if country code has already been entered before
        countryCode = countryCode.rows[0].country_code;
        if (countries.includes(countryCode)){
          // Render Error Message showing that country already exists
          res.render("index.ejs", {
            countries: countries,
            total: countries.length,
            users: users,
            color: currentUserColor,
            error: `${inputCountry} Is Already In Country List. Try Again.`});
        } else {

          await db.query(
            "INSERT INTO visited_countries (country_id, member_id) VALUES ($1, $2)",
            [countryId, currentUserId]
          );
          res.redirect("/");
        }
      } catch (err) {
        console.log(err);
      }
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/remove", async (req, res) => {
  const countries = await checkVisisted();
  const users = await checkUsers();
  const inputCountry = req.body.country;
  currentUserColor = users.find((user) => user.id == currentUserId).color;
  currentUser = users.find((user) => user.id == currentUserId);

  try {
    const resultId = await db.query(
      "SELECT id FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [inputCountry.toLowerCase()]
    );

    // Confirm that valid result was found
    if(resultId.rows.length != 1){
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUserColor,
        error: `${inputCountry} is not a country! Try Again.`
      });
    } else {
      const idData = resultId.rows[0];
      const countryId = idData.id;

      try {
        let countryCode = await db.query("SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';", [inputCountry.toLowerCase()]);
        // Check if country code has not been entered before
        countryCode = countryCode.rows[0].country_code;
        if (!countries.includes(countryCode)){
          // Render Error Message showing that country already exists
          res.render("index.ejs", {
            countries: countries,
            total: countries.length,
            users: users,
            color: currentUserColor,
            error: `${currentUser.name} has never been to ${inputCountry}. Try Again.`});
        } else {

          await db.query(
            "DELETE FROM visited_countries WHERE country_id = $1", [countryId]
          );
          res.redirect("/");
        }
      } catch (err) {
        console.log(err);
      }
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/user", async (req, res) => {

  // If adding a new user tab is clicked
  if(req.body.add == "new") {
    console.log("New user requested!!!")
    console.log(req.body)
    res.render("new.ejs");

    // If editing a user is clicked
  } else if(req.body.edit == "edit") {
    console.log("User modification requested!!!")
    console.log(req.body)

    // Which user would you like to edit?
    res.render("edit.ejs", {memberName: currentUser.name, memberColor: currentUser.color});
  } else {

    currentUserId = req.body.user;
    res.redirect("/")
  }
});

app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html

  // Set default color if user does not enter one
  let color = req.body.color || DEFAULT_COLOR;
  if (req.body.name == "") {
    res.render("new.ejs", {error: "Error: Missing name entry. Please enter your name."})
  } else {

    try {
      await db.query(
        "INSERT INTO family_members (name, color) VALUES ($1, $2)",
        [req.body.name, color]
      );
      res.redirect("/");
    } catch (err) {
      console.log(err);
    }
  }
});

app.post("/edit", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html

  let color = req.body.color || currentUser.color;
  let name = req.body.name;
  if (name == "") {
    name = currentUser.name;
  }
  try {
    await db.query(
      "UPDATE family_members SET name = $2, color = $3 WHERE id = $1",
      [currentUserId, name, color]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.post("/removeMember", async (req, res) => {

  try {
    await db.query(
      "DELETE FROM visited_countries WHERE member_id = $1", [currentUserId]
    );
    await db.query(
      "DELETE FROM family_members WHERE id = $1", [currentUserId]
    );
    currentUserId = 1;
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
