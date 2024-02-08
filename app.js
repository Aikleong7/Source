/*
 * 'require' is similar to import used in Java and Python.
 * It brings in the libraries required to be used in this JS file.
 * */
// const passportConfig = require("./config/passportConfig");
// var flashMessenger =  require('flash-messenger');
// const DBConnection = require("./config/DBConnection");
// const helpers = require("./helpers/handlebars");

const cookieParser = require("cookie-parser");
const MySQLStore = require("express-mysql-session");
const session = require("express-session");
const express = require("express");
// const flash = require("connect-flash");

const { engine } = require("express-handlebars");
// var express_handlebars_sections = require("express-handlebars-sections");


const Handlebars = require("handlebars");
const passport = require("passport");
const path = require("path");
const app = express();

require("dotenv").config();

app.engine(
  "handlebars",
  engine({
    handlebars: Handlebars,
    defaultLayout: "main" // Specify default template views/layout/main.handlebar
  })
);

// app.engine('handlebars', engine({
//     section: express_handlebars_sections()  // CONFIGURE 'express_handlebars_sections'
//     // properties used by express-handlebars configuration ...
// }));
app.set("view engine", "handlebars");

// Express middleware to parse HTTP body in order to read HTTP data
app.use(
  express.urlencoded({
    extended: false,
  })
);
app.use(express.json());
// Creates static folder for publicly accessible HTML, CSS and Javascript files
app.use(express.static(path.join(__dirname, "public")));

// Enables session to be stored using browser's Cookie ID
app.use(cookieParser());

// var options = {
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PWD,
//   database: process.env.DB_NAME,
//   clearExpired: true,
//   // The maximum age of a valid session; milliseconds:
//   expiration: 3600000, // 1 hour = 60x60x1000 milliseconds
//   // How frequently expired sessions will be cleared; milliseconds:
//   checkExpirationInterval: 1800000, // 30 min
// };

// Messaging library
// const flash = require("connect-flash");
const flash = require("connect-flash");
app.use(flash());
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(flashMessenger.middleware);
// To store session information. By default it is stored as a cookie on browser
app.use(
  session({
    key: "assignment",
    secret: "y2s1",
    // store: new MySQLStore(options),
    resave: true,
    saveUninitialized: true,
  })
);

// Connects to MySQL database
// DBConnection.setUpDB(false); // To set up database with new tables (true)
// Passport Config
// passportConfig.localStrategy(passport);
// passportConfig.googleStrategy(passport);
// Initilize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Place to define global variables
app.use(function (req, res, next) {
  res.locals.message = req.flash("message");
  res.locals.error = req.flash("error");
  res.locals.user = req.user || null;
  next();
});

app.use("/", require("./routes/home"));


const port = 80;
// Starts the server and listen to port
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
