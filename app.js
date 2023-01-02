/**
 * Nate Chen
 * 3/9/22
 * Section AE
 *
 * Server-side JS for my HW4 submission. Creates a Yipper API with four endpoints: retrieving all
 * yips or retrieving yip IDs by matching to a search keyword, retrieving all yips for a certain
 * user, updating number of likes for a yip, and creating a new yip. See APIDOC.md for more
 * details.
 */
"use strict";
const express = require("express");
const app = express();
const multer = require("multer");

app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(multer().none());

const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');

/**
 * Returns an array of all yip data in the yips database, or if a search term is provided, an array
 * of yip ids corresponding to yips that contain the search term.
 */
app.get("/yipper/yips", async (req, res) => {
  try {
    let search = req.query.search;
    let yips;
    let db = await getDBConnection();
    if (!search) {
      let sql = "SELECT id, name, yip, hashtag, likes, date FROM yips ORDER BY DATETIME(date) DESC";
      yips = await db.all(sql);
    } else {
      let sql = "SELECT id FROM yips WHERE yip LIKE ?;";
      yips = await db.all(sql, [("%" + search + "%")]);
    }
    await db.close();
    res.json({
      "yips": yips
    });
  } catch (err) {
    res.type("text");
    res.status(500).send("An error occurred on the server. Try again later.");
  }
});

/**
 * Returns an array of all yip data for a specified user. Returns a plaintext message if the user
 * does not exist in the yips database.
 */
app.get("/yipper/user/:user", async (req, res) => {
  try {
    let user = req.params.user;
    if (!(await checkUser(user))) {
      res.status(400).send("Yikes. User does not exist.");
    } else {
      let db = await getDBConnection();
      let sql = "SELECT name, yip, hashtag, date FROM yips WHERE name = ? " +
        "ORDER BY DATETIME(date) DESC;";
      let yips = await db.all(sql, [user]);
      await db.close();
      res.json(yips);
    }
  } catch (err) {
    res.type("text");
    res.status(500).send("An error occurred on the server. Try again later.");
  }
});

/**
 * Updates the likes for the yip whose id is given, increments it by 1, updating the database and
 * returning the new like count as plaintext.
 */
app.post("/yipper/likes", async (req, res) => {
  try {
    res.type("text");
    let id = req.body.id;
    if (!id) {
      res.status(400).send("Missing one or more of the required params.");
    } else {
      let db = await getDBConnection();
      let countQuery = "SELECT id, likes FROM yips WHERE id = ?;";
      let count = await db.get(countQuery, [id]);
      if (!count) {
        res.status(400).send("Yikes. ID does not exist.");
      } else {
        count = count.likes + 1;
        let countUpdate = "UPDATE yips SET likes = ? WHERE id = ?;";
        await db.run(countUpdate, [count, id]);
        db.close();
        res.send(count + "");
      }
    }
  } catch (err) {
    res.status(500).send("An error occurred on the server. Try again later.");
  }
});

// Adds a new yip for an existing user to the Yipper database, and returns the new yip to the user.
app.post("/yipper/new", async (req, res) => {
  try {
    res.type("text");
    let name = req.body.name;
    let full = req.body.full;
    if (!name || !full) {
      res.status(400).send("Missing one or more of the required params.");
    } else if (!(await checkUser(name))) {
      res.status(400).send("Yikes. User does not exist.");
    } else if (!checkYip(full)) {
      res.status(400).send("Yikes. Yip format is invalid.");
    } else {
      let hashtagIdx = full.indexOf("#");
      let yip = full.substring(0, hashtagIdx - 1); // - 1 accounts for space before hashtag
      let hashtag = full.substring(hashtagIdx + 1); // + 1 excludes hashtag
      let db = await getDBConnection();
      let insertStatement = "INSERT INTO yips (name, yip, hashtag, likes) VALUES (?, ?, ?, 0);";
      let insert = await db.run(insertStatement, [name, yip, hashtag]);
      let query = "SELECT * FROM yips WHERE id = " + insert.lastID;
      let result = await db.get(query);
      db.close();
      res.json(result);
    }
  } catch (err) {
    res.status(500).send("An error occurred on the server. Try again later.");
  }
});

/**
 * Checks that a user exists in the database of Yipper posts.
 * @param {String} user - the user to check for in the Yipper database
 * @returns {Boolean} - true if the user has at least one post in the database, false otherwise
 */
async function checkUser(user) {
  let db = await getDBConnection();
  let query = "SELECT * FROM yips WHERE name = ?;";
  let results = await db.all(query, [user]);
  db.close();
  return results.length !== 0;
}

/**
 * Checks that a string follows the format for a proper Yip.
 * @param {String} full - the string to be checked for
 * @returns {Boolean} - true if the string matches the Yip format, false otherwise
 */
function checkYip(full) {
  let regex = /^[A-Za-z0-9.?!_ ]+ #[A-Za-z0-9]+$/;
  let result = full.match(regex);
  return result !== null;
}

/**
 * Establishes a database connection to the database and returns the database object.
 * Any errors that occur should be caught in the function that calls this one.
 * @returns {Object} - The database object for the connection.
 */
async function getDBConnection() {
  const db = await sqlite.open({
    filename: "yipper.db", // replace this with db file name
    driver: sqlite3.Database
  });

  return db;
}

app.use(express.static("public"));
const PORT = process.env.PORT || 8000;
app.listen(PORT);