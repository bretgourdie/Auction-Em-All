
/**
 * Module dependencies.
 */

var express = require('express');
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
        //socket.broadcast.emit('chat', username + ' has entered the room.');
        
    });

    socket.on('disconnect', function () {
        var disconnectedUsername = socketToUser[socket.id];
        socketToUser.splice(socket.id, 1);
        userList.splice(userList.indexOf(disconnectedUsername), 1);
        console.log("CONNECTION: " + disconnectedUsername + " disconnected");
        console.log("USERLIST: " + userList);
        socket.broadcast.emit("chat", disconnectedUsername + " has left the room.");
    });

    socket.on('chat', function (bold, nonbold) {
        console.log("CHAT: " + bold + ": " + nonbold);
        io.sockets.emit("chat", bold, nonbold);
    });

    socket.on('bidstart', function () {
        biddingTime = true;
        topBidUser = "Nobody";
        topBid = 0;
        console.log("BIDSTART: " + socketToUser[socket.id] + " is starting the bidding!");
        io.sockets.emit("chat", "Bidding begins in 10 seconds!", "");
        io.sockets.emit("bidstart");
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

    socket.on('bidend', function () {
        biddingTime = false;
        console.log("BIDEND: " + socketToUser[socket.id] + " saying bidding has ended");
        console.log("BIDRESULT: " + topBidUser + " won with bid of " + topBid);

        if (topBid == 0) {
            io.sockets.emit("chat", "Nobody bid this round! This guy is crap!", "");
        }
        
        else {
            io.sockets.emit('chat', topBidUser + " won with their bid of " + topBid + "!", "");
        }
        io.sockets.emit("bidend", topBidUser);
    });

    /* Place to put more socket events */
});

