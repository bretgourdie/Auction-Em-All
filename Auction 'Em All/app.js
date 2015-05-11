
/**
 * Module dependencies.
 */

var express = require('express');
var fs = require("fs");
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var userList = [];
var socketToUser = [];
var priviledgedUsers = [];
var biddingTime = false;
var topBid = 0;
var topBidUser = "";
var currentDrafter = "";
var minBid = 0;
var draftAndMinBid = [];
var promotePassword = "badminmike";

var currentCheckedIn = 0;

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

var data = fs.readFileSync("./draft/ListOfPokes.csv", "ascii");

console.log("DATARESULT:\n\n" + data + "\n\nDATAEND\n");

fs = null;

draftAndMinBid = data.split("\r\n");

var serve = http.createServer(app);
var io = require('socket.io')(serve);

serve.listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get("port"));
});

io.on("connection", function (socket) {
    console.log("CONNECTION: a user connected");
    
    socket.on("register", function registerUser(username) {
        userList.push(username);
        socketToUser[socket.id] = username;
        console.log("REGISTER: " + username);
        console.log("USERLIST: " + userList);
        io.sockets.emit("register", username, userList);
        
    });

    socket.on('disconnect', function () {
        var disconnectedUsername = socketToUser[socket.id];
        socketToUser.splice(socket.id, 1);
        userList.splice(userList.indexOf(disconnectedUsername), 1);
        console.log("CONNECTION: " + disconnectedUsername + " disconnected");
        socket.broadcast.emit("chat", disconnectedUsername + " has left the room.");
        console.log("USERLIST: sending \"" + userList + "\"");
        socket.broadcast.emit("getUserList", userList);
    });

    socket.on('chat', function (bold, nonbold) {
        console.log("CHAT: " + bold + ": " + nonbold);
        io.sockets.emit("chat", bold, nonbold);
    });
    
    socket.on("startall", function () {
        console.log("STARTALL: " + socketToUser[socket.id] + " is starting the bidding process! Waiting for checkins...");
        io.sockets.emit("requestCheckin");
    });
    
    socket.on("checkin", function () {
        currentCheckedIn++;
        
        console.log("CHECKIN: " + currentCheckedIn + " users have checked in");

        if (currentCheckedIn == userList.length) {
            
            console.log("CHECKIN: Everybody's in! Start bidding!");
            startTheBidding();
        }
    });

    socket.on('startbid', function () {
        console.log("STARTBID: " + socketToUser[socket.id] + " is manually starting the bidding!");
        startTheBidding();
    });

    socket.on('bid', function (user, bid) {
        console.log("BID: " + user + ": " + bid);

        if (biddingTime && bid > topBid) {
            topBid = bid;
            topBidUser = user;
            console.log("BID RESULT: " + topBidUser + ": " + topBid);
            io.sockets.emit('bid', topBidUser, topBid);
        }
        else if (!biddingTime) {
            console.log("BID RESULT: " + user + " is trying to bid when it's not bidding time");
            socket.emit("chat", user + ", it's not time to bid right now!", "");
        }
        else if(bid <= topBid){
            console.log("BID RESULT: " + user + ": not bid enough");
            socket.emit("chat", "Someone has already outbid you. Try again!", "");
        }
    });

    socket.on('endbid', function () {

        biddingTime = false;
        console.log("ENDBID: " + socketToUser[socket.id] + " saying bidding has ended");
        console.log("BIDRESULT: " + topBidUser + " won with bid of " + topBid);
            
        if (topBid == 0) {
            socket.emit("chat", "Nobody", " bid this round! This guy is crap!");
        }
        
        else {
            socket.emit('chat', topBidUser + " won with their bid of " + topBid + "!", "");
        }
        socket.emit("endbid", topBidUser, topBid, currentDrafter);
        
    });
    
    socket.on("endall", function () {
        console.log("ENDALL: ending bid prematurely");
        io.sockets.emit("donebid");
    });

    socket.on("promote", function (password) {
        if (password == promotePassword) {
            console.log("PROMOTE: promoting " + socketToUser[socket.id]);
        }
        
        else {
            console.log("PROMOTE: " + socketToUser[socket.id] + " failed promotion with password \"" + password + "\"");
        }
        
        socket.emit("promote", password == promotePassword);
    });
    
    socket.on("admin", function (msg) {
        io.sockets.emit("admin", msg);
    });

    socket.on("setpoints", function (userToGive, numPoints) {
        console.log("SETPOINTS: giving " + userToGive + " " + numPoints + " points");
        io.sockets.emit("setpoints", userToGive, numPoints);
    });
    
    socket.on("addpoints", function (userToGive, numPoints) {
        console.log("ADDPOINTS: adding " + numPoints + " points to " + userToGive);
        io.sockets.emit("addpoints", userToGive, numPoints);
    });

    socket.on("setlastmember", function (userToSet, teammate) {
        console.log("SETLASTMEMBER: setting " + userToSet + "'s last guy to " + teammate);
        io.sockets.emit("setlastmember", userToSet, teammate);
    });

    socket.on("endall", function () {
        draftAndMinBid = [];
    });
});

function startTheBidding(){
    
    currentCheckedIn = 0;
    
    if (draftAndMinBid.length > 0) {
        biddingTime = true;
        topBidUser = null;
        topBid = 0;
        setDrafterAndMinBid();
        io.sockets.emit("chat", "Bidding begins in 10 seconds!", "");
        io.sockets.emit("startbid", currentDrafter, minBid);
    }

    else {
        console.log("Done with bidding!");
        io.sockets.emit("admin", "Team logs as follows:");
        io.sockets.emit("donebid");
    }
}

function setDrafterAndMinBid(){
    var curEntry = draftAndMinBid.shift();
    var splitEntry = curEntry.split(",");

    currentDrafter = splitEntry[0];
    minBid = splitEntry[1];

    console.log("SETDRAFTERANDMIN: Grabbed \"" + currentDrafter + "\" for " + minBid);
}
