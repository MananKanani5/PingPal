const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const flash = require("connect-flash");
const MongoStore = require("connect-mongo");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

const app = express();
const mongoConnect = require("./connection");
const User = require("./models/users.js");
const Chat = require("./models/chats.js");
const passportConfig = require("./utils/passport.js");

// Mongo DB Connections
mongoConnect();

// Middleware Connections
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SECRET, // Make sure this is set in your .env file
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGO_DB_URL }),
  })
);
app.use(passport.initialize());
app.use(passport.session());
passportConfig(passport);
app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
});

const server = http.createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  // console.log("New WebSocket connection...");

  socket.on("joinChat", ({ senderId, recipientId }) => {
    // console.log(`User ${senderId} joined chat with ${recipientId}`);
    const room = [senderId, recipientId].sort().join("-");
    socket.join(room);
  });

  socket.on("sendMessage", async ({ senderId, recipientId, message }) => {
    const room = [senderId, recipientId].sort().join("-");

    const chatMessage = new Chat({
      sender: senderId,
      recipient: recipientId,
      message,
    });

    try {
      await chatMessage.save();
      io.to(room).emit("newMessage", { senderId, recipientId, message });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });
});

// Routes
app.get("/", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/dashboard");
  res.render("index", { user: req.user });
});

app.get("/login", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/dashboard");
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/signup", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/dashboard");
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  try {
    const newUser = new User({ ...req.body });
    await newUser.save();
    req.flash("success_msg", "You are now registered and can log in");
    res.redirect("/login");
  } catch (err) {
    console.log(err);
    req.flash("error_msg", "Error registering new user.");
    res.status(500).redirect("/signup");
  }
});

app.get("/dashboard", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const users = await User.find({ _id: { $ne: req.user._id } });
      return res.render("dashboard", { user: req.user, users });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).send("Server Error");
    }
  }
  res.redirect("/login");
});

app.get("/chat/:id", async (req, res) => {
  const recipientId = req.params.id;
  const senderId = req.user._id;
  try {
    const chats = await Chat.find({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId },
      ],
    }).sort({ timestamp: 1 });
    const recipient = await User.findById(recipientId);
    const recipientUsername = recipient ? recipient.username : "Unknown";
    res.render("chat", {
      user: req.user,
      recipientId,
      recipientUsername,
      chats,
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).send("Server Error");
  }
});

app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.flash("success_msg", "You are logged out");
    res.redirect("/login");
  });
});

// Connection
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log("App running on port: " + PORT);
});
