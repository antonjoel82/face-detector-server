/* Libraries */
const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt-nodejs");
const cors = require("cors");
const knex = require("knex");

/* Helper files */
const constants = require("./server-constants");

const app = express();
app.listen(constants.PORT, () => {
	console.debug(`App is up and running on Port ${constants.PORT}`);
});

const db = knex({
  client: 'pg',
  connection: {
    host : '127.0.0.1',
    user : 'postgres',
    password : 'test',
    database : 'face-detector'
  }
});

//Middleware
app.use(cors());
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

// app.get("/", (req, res) => {
// 	res.json("Hitting Root Page.");
// })

app.post("/signin", (req, res) => {
	db.select("email", "hash")
		.from("login")
		.where({email: req.body.email.toLowerCase()})
		.then((login) => {
			if (bcrypt.compareSync(req.body.password, login[0].hash)) {
				db.select("*")
					.from("users")
					.where({email: login[0].email})
					.then((users) => {
						console.debug("Signing in user: ", users[0]);
						res.json(users[0]);
					})
					.catch((err) => {
						res.status(400).json("Unable to retrieve user.");
					});
			} else {
				res.status(400).json("Invalid credentials...");
			}
		})
		.catch((err) => {
			res.status(400).json("Invalid credentials...");
		});
})

/**
 * REGISTER NEW USER
 */
app.post("/register", (req, res) => {
	const {email, name, password} = req.body;
	const hash = bcrypt.hashSync(password);

	db.transaction((trx) => {
		trx.insert({
			hash,
			email: email.toLowerCase(),
		})
		.into("login")
		.returning("email")
		.then((loginEmail) => {
			return trx("users")
					.returning("*")
					.insert({
						email: loginEmail[0],
						name,
						joined: new Date()
					})
					.then((users) => {
						console.debug("Registered new user: ", users[0]);
						return res.json(users[0]);
					})
					.catch((err) => {
						console.debug(err);
						return res.status(400).json(`Could not register user. Reason: ${err.detail}`);
					})
			})
			.then(trx.commit)
			.catch(trx.rollback);
	})
});

app.get("/profile/:userId", (req, res) => {
	const id = req.params.userId;

	db.select("*")
		.from("users")
		.where({id})
		.then((users) => {
			if (users.length) {
				res.json(users[0]);
			} else {
				res.status(404).send("User not found.")
			}
		})
		.catch((err) => {
			res.status(404).send("Error getting user.")
		})
});

app.put("/image", (req, res) => {
	const id = req.body.id;
	const score = req.body.score;

	db("users")
		.returning("entries")
		.where({id})
		.modify((qb) => {
			//If there is a successful, score, increment it by that much
			//Otherwise, reset the score to 0!
			if (score) {
				console.debug("Incremented score: ", score);
				qb.increment("entries", score);
			} else {
				console.debug("Resetting user score to 0!");
				qb.update({entries: 0});
			}
		})
		.then((entries) => {
			console.debug("Entries: ", entries[0]);
			res.json(Number(entries[0]));
		})
		.catch((err) => {
			console.debug(err);
			res.status(400).send("Could not update score.")
		});
});