//jshint esversion:6
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
//require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const date = require(__dirname + "/date.js");
const app = express();
var logger = require('morgan');
var path = require('path');

//add for login
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require('mongoose-findorcreate');
var cookieParser = require('cookie-parser');


// Connect to mongodb
const URI = process.env.MONGODB_URL
mongoose.connect(URI, {
    //useCreateIndex: true,
    //useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
}, err => {
    if(err) throw err;
    console.log("Connected to mongodb");
})



//passport and session
app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false,
  session: false //added to not store cookie
}));


app.use(passport.initialize()); //This stays in app.js
app.use(passport.session()); //This stays in app.js

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


const userSchema = new mongoose.Schema ({ //user Schema NOT blog
  username: String,
  password: String,
});


userSchema.plugin(passportLocalMongoose);
  userSchema.plugin(findOrCreate);
  
  const User = new mongoose.model("User", userSchema);
  

  
  passport.use(User.createStrategy());
  
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });



//let items = []; //empty items object (datastore)

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

//mongoose.connect("mongodb://localhost:27017/todolistDB", {useNewUrlParser: true});

//create global variable for date



let day = date.getDate();

//create an items schema
const itemsSchema = {
  name: String
};

const listSchema = { //schema for custom list of array
  name: String,
  items: [itemsSchema]
}

const Item = mongoose.model("Item", itemsSchema); //Item Model
const List = mongoose.model("List", listSchema); //List Model for custom list collection /work, /shopping, etc..


app.get("/", function(req, res) { //redirect homepage to login for me only

  
  
  res.render("login", {myDate: day, listTitle: "Today"});
 
});


app.get("/login", function(req, res){
  res.render("login");
});

/*
//register get and post
app.get("/register", function(req, res) {
  res.render("register");
});

app.post("/register", function(req, res) {
  const {username, password, password2} = req.body;

  //check if match
if(password !== password2) {
console.log("Passwords don't match");
}

//check if password is more than 6 characters
if(password.length < 6 ) {
console.log("Passwords must be at least 6 characters");
}

  User.register({username: username}, password, function(err, user) {
    if(err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
          res.redirect("/adminlist");
      });
    }
  });
 });
*/
 app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err) {
    if(err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        //res.render('admin',{
          //user: req.user
          
          //});
          //res.render('admin.ejs', { user: req.user })
        res.redirect("/adminlist");
    });
    }
  });
});


app.get("/adminlist", function(req, res){
  //res.set('Cache-Control', 'no-store'); //not needed
  if (req.isAuthenticated()){
    Item.find({}, function(err, foundItems){
  
      if (err) {
        console.log(err);
      } 
      else {
        res.render("adminlist", {myDate: day, listTitle: "Today", newListItems: foundItems}); //changing from mylist to adminlist
      }
    });
  } 
  
  else {
    res.redirect("/");
  }
});

/*
app.get("/showalllist", function(req, res){
  //res.set('Cache-Control', 'no-store'); //not needed

  if (req.isAuthenticated()){
    Item.find({}, function(err, foundItems){
  
      if (err) {
        console.log(err);
      } 
      else {
        res.render("showalllist", {myDate: day, listTitle: "Today", newListItems: foundItems}); //changing from mylist to adminlist
      }
    });
  } 
  
  else {
    res.redirect("/");
  }

});
*/

app.post('/logout', function(req, res, next) {
req.logout(function(err) {
if (err) { return next(err); }
res.redirect('/');
});
});


app
.route('/logout')
.get((req, res) => {
    req.logout(function(err) {
         if (err) { return next(err); }
     res.redirect('/');
});
});


app.post("/", function(req, res) { //add list to db
  
  if (req.isAuthenticated()){

  console.log(req.body); //DO NOT REMOVE
  const itemName = req.body.addTask; //from ejs template html field
  const listName = req.body.mylist; //from ejs template html field
  
    //New Item document in MongoDB

  const item = new Item({
    name: itemName
  });

  if(listName === "Today") {
    item.save(); //save item in our collection of items

  res.redirect("/adminlist"); //redirect back to home page
  }

  else {
    List.findOne({name: listName}, function(err, foundList) {
      foundList.items.push(item); //push the new item for custom list
      foundList.save(); //update new date

      res.redirect("/adminlist" + listName);
    });
    
  } //end else

}
else {
  res.redirect("/");
}

});



/*
app
.route("/edit/:id")
.get((req, res) => {
const id = req.params.id;
Item.find({}, (err, tasks) => {
res.render("/", { name: listName, idTask: id });
});
})
.post((req, res) => {
const id = req.params.id;
Item.findByIdAndUpdate(id, { listName: req.body.listName }, err => {
if (err) return res.send(500, err);
res.redirect("/");
});
});
*/


app.post("/delete", function(req, res){
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName; //which list did the item come from

  if (listName === "Today") {
    Item.findByIdAndRemove(checkedItemId, function(err){
      if (!err) {
        console.log("Successfully deleted checked item.");
        res.redirect("/adminlist");
      }
    });
  } 
  
  
  else {
    List.findOneAndUpdate({name: listName}, {$pull: {items: {_id: checkedItemId}}}, function(err, foundList){ //custom list like /work /shipping etc.. PULL FROM ITEM ID removes the checkedItemId and updates it pull or pullall to remove ID
      if (!err){
        res.redirect("/" + listName);
      }
    });
  }

});


app.get("/:customListName*", function(req, res) {

  if (req.isAuthenticated()){
  const customListName = _.capitalize(req.params.customListName);
 
  List.findOne({name: customListName}, function(err, foundList) {
    if(!err) {
      if(!foundList) {
        //Create a custom list
        const list = new List({
          name: customListName
          //items: defaultItems (NOT NEEDED)
         });
         list.save();
         res.redirect("/" + customListName);
        //console.log("Dosen't exists")
      }
      else {
        //console.log("exists");
        //show existing list
        res.render("mylist", {myDate: day, listTitle: foundList.name, newListItems: foundList.items})
      }
    }
  });

}

else {
  res.redirect("/");
}

});


app.listen(3000, function() {
  console.log("Server started on port 3000");
});
