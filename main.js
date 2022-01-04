//
//SERVER CODE
//
const express = require("express");
const cookieParser = require('cookie-parser');
const HTTP = require("http");
const PORT = 3000;
const fs = require("fs");
const cookie = require("cookie");

const app = express();
app.use(express.json());
app.set("view engine", "ejs");
app.use(cookieParser())

const DEFAULTPLAYERSTATE = {playing: false}

const server = HTTP.createServer(app);
const io = require('socket.io')(server);

function grabData()
{
  return JSON.parse(fs.readFileSync("playerData.json"));
}

function pushData(database)
{
  fs.writeFileSync("playerData.json", JSON.stringify(database));
}

function resetDatabase()
{
                                                                  // games: endpoint: 
                                                                  // {playerone: id,
                                                                  //  playertwo: id, 
                                                                  //  messages: 
                                                                  //  board: [[][][]]}
  fs.writeFileSync("playerData.json", '{ "players": {}, "queue": [], "games": {} }')
}

function addToQueue(player)
{
  let database = grabData();
  database["queue"].push(player);
  pushData(database);
  return database;
}

function removeFromQueue(player)
{
  let database = grabData();
  if (database['queue'].includes(player))
  {
    database["queue"].splice(database["queue"].indexOf(player), 1);
    pushData(database);
    console.log("removed", player);
  }
  
  return database;
}

// expecting a dict [data] with endpoint, data, id, type
function handleUpdate(data)
{
  var database = grabData();
  if (!database['games'][data["endpoint"]]) // if the game doesn't exist
  {
    // game didn't get registered (BIG PROBLEM)
    console.error("UNREGISTERED GAME IN PLAY", data, database);
  }
  else 
  {
    if (data['type'] === "MESSAGE")
      database['games'][data['endpoint']]["messages"].push(data['data']);
    
    pushData(database);
  }

}

// returns a random which is not already in the system
function randomID()
{
  let database = grabData()
  let value = Math.floor((89999 * (Math.random())) + 10000);
  while (database[value]) // todo:  fix this random generator
  {
    value = Math.floor((89999 * (Math.random())) + 10000);
  }
  
  database["players"][value] = DEFAULTPLAYERSTATE;
  //console.log(database);
  pushData(database);
  return value;

}

resetDatabase()
// for (var i = 0; i < 10; i++)
// {
//   randomID();
// }

app.get('/', (req, res) => {
  let database = grabData();
  let myID = 0;
  if (!req.cookies["id"]) //todo: make a button so people can reset this
  {
    myID = randomID();
    res.cookie("id", myID);
  }
  else 
  {
    myID = req.cookies["id"];
  }
  if (!database[myID]) //if they're somehow not in the database
  {
    database["players"][myID] = DEFAULTPLAYERSTATE;
  }
  if (database["players"][myID].playing) // if they're playing a game autoredirect them into that game
  {
    // todo: autoredirect into a game
    console.log("redirecting you into your game")
  }
  // first, random, because it will be easier

  //console.log(database);
  
  //res.cookie("partner", [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  res.render('index', data = {id: myID});
  return;
});

app.post("/inqueue", (req, res) => {
  // if there's no one to play with, add them to a queue and redirect to a waiting page
  var database = grabData();
  var playerID = req.cookies['id']
  if (!database['queue'].length) // if the queue is empty
  {
    addToQueue(playerID);
    res.render("inqueue", data = {id: playerID})
    return;
  }
  else // if there is someone to play with, randomly choose someone and connect the two
  {
    // don't continue if they're the only one in the queue
    if (database['queue'].includes(playerID) && database['queue'].length == 1)
    {
      res.render("inqueue", data = {id: playerID})
      return;
    }
    //  remove them from the queue
    database = removeFromQueue(playerID)
    //  randomly choose someone out of the queue
    var buddy = database['queue'][Math.floor(Math.random() * database['queue'].length)]
    // remove the buddy 
    database = removeFromQueue(buddy);
    //create custom endpoint
    var endpoint = `/game/${playerID.toString() + buddy.toString()}`
    // alert the buddy that they've been chosen and tell them where to go
    io.emit(`inqueue_status/${buddy}`, endpoint);
    // initalize their connection in the database
    database['games'][endpoint] = {"playerOne": playerID, 
                                   "playerTwo": buddy, 
                                   "messages": [],
                                   "board": [[0, 0, 0], [0, 0, 0], [0, 0, 0]]}
    database = pushData(database);
    // send player to the same endpoint
    res.redirect(endpoint)
    return;
  }
  
});

app.get("/game/:gameID", (req, res) => {
  // var database = grabData();
  var database = grabData();
  var startingMessages = [];
  console.log(req.params);
  console.log()
  if (database["games"][`/game/${req.params["gameID"]}`])
    startingMessages = database["games"][`/game/${req.params["gameID"]}`]["messages"]

  console.log(database, startingMessages);
  res.render("gamepage", data = {"id": req.cookies["id"],
                                 "messages": startingMessages})
});

io.on("connection", (socket) => {
  var URL = socket.handshake.headers.referer;
  var socketID = socket.id;
  var playerID = cookie.parse(socket.handshake.headers.cookie)["id"]
  console.log(playerID, "connected to:", URL, "with", socketID);
  console.log(grabData());
  socket.on("disconnect", () => {
    console.log(playerID , "disconnected from:", URL, "with", socketID);
    // if they leave the queue page then remove them from the queue
    // (because of the site's setup, remove them from the queue if they disconnect from anypage [assuming they're in the queue])
    removeFromQueue(playerID);

    //we need a check here for when they disconnect from the game, that way we can remove it when both parties have left
  })
  socket.on("sendMessage", (value) => {
    handleUpdate(value);
    // send messages to both players
    io.emit(`recieveMessage/${value["endpoint"]}`, value["data"])
  })
  
})





// app.get('/inqueue', (req, res) => {
//   // add the person to the queue and be ready to pull them out
//   let database = grabData();
//   console.log("testing");
//   removeFromQueue(req.cookies['id']);
//   let buddy = database['queue'][Math.floor(Math.random() * database['queue'].length)];
//   removeFromQueue(buddy);
// });

server.listen(
        PORT, 
        () => console.log(`Running on http://localhost:${PORT}`)
);



