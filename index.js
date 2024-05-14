import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

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

// Full Many-To-Many Table
const table = "visited_countries JOIN countries ON countries.id = visited_countries.country_id JOIN family_members ON family_members.id = visited_countries.member_id"

async function checkVisisted() {
  console.log("Checking visited...");

  const result = await db.query("SELECT country_code FROM " + table + " WHERE member_id = " + currentUserId + ";");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function checkUsers() {
  console.log("Checking users...");
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

app.post("/user", async (req, res) => {
  // If adding a new user tab is clicked
  if(req.body.add == "new") {
    console.log("New user requested!!!")
    res.render("new.ejs");
  } else {

    currentUserId = req.body.user;
    res.redirect("/")
  }
});

app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html

  try {
    await db.query(
      "INSERT INTO family_members (name, color) VALUES ($1, $2)",
      [req.body.name, req.body.color]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
