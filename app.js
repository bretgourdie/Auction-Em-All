
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
var oldDrafts = [];
var oldBids = [];
var promotePassword = "badminmike";
var autoNext = true;

var currentCheckedIn = 0;

var app = express();

// all environments
app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 3000);
app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");
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

draftAndMinBid = data.split("\r\n");

var serve = http.createServer(app);
var io = require('socket.io')(serve);

console.log("ABOUT TO DO THE LISTEN NOW");

serve.listen(app.get('port'), function (err) {
	if(err){
		throw err;
	}

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
    
    socket.on("checkin", function () {
        currentCheckedIn++;
        
        console.log("CHECKIN: " + currentCheckedIn + " users have checked in");

        if (currentCheckedIn == userList.length) {
            
            console.log("CHECKIN: Everybody's in! Start bidding!");
            startTheBidding();
        }
    });

    socket.on('startbid', function () {
        console.log("STARTBID: " + socketToUser[socket.id] + " is starting the bidding!");
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

    socket.on('endbidindividual', function () {

        biddingTime = false;
        console.log("ENDBIDINDIVIDUAL: " + socketToUser[socket.id] + " saying bidding has ended");
        console.log("BIDRESULT: " + topBidUser + " won with bid of " + topBid);
            
        if (topBid == 0) {
            socket.emit("chat", "Nobody", " bid this round! This guy is crap!");
        }
        
        else {
            socket.emit('chat', topBidUser + " won with their bid of " + topBid + "!", "");
        }
        
        oldBids.push(topBidUser + "," + topBid);
        
        if (autoNext) {
            socket.emit("endbid", topBidUser, topBid, currentDrafter);
        }
        
    });
    
    socket.on("endbid", function () {
        biddingTime = false;
        console.log("ENDBID: " + socketToUser[socket.id] + " ending the bidding for everyone");
        console.log("BIDRESULT: " + topBidUser + " won with a bid of " + topBid);

        if (topBid == 0) {
            io.sockets.emit("chat", "Nobody", " bid this round! This guy is crap!");
        }

        else {
            io.sockets.emit("chat", topBidUser + " won with their bid of " + topBid + "!", "");
        }

        oldBids.push(topBidUser + "," + topBid);

        if (autoNext) {
            io.sockets.emit("endbid", topBidUser, topBid, currentDrafter);
        }

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
    
    socket.on("peekpoints", function (userToPeek) {
        console.log("PEEKPOINTS: " + socketToUser[socket.id] + " wants to know " + userToPeek + "'s points");
        io.sockets.emit("peekpoints", userToPeek);
    });
    
    socket.on("admin", function (msg) {
        console.log("ADMIN: " + msg);
        io.sockets.emit("admin", msg);
    });
    
    socket.on("redocurrent", function () {
        if (oldDrafts.length > 0) {
            putLastDraftOnTop("REDOCURRENT");
            
            io.sockets.emit("redo");
            
            startTheBidding();
        }
        else {
            io.sockets.emit("admin", socketToUser[socket.id] + " is trying to redo nothing");
        }

    });
    
    socket.on("redolast", function () {
        if (oldDrafts.length > 1) {
            putLastDraftOnTop("REDOLAST");
            
            refundLastBid("REDOLAST");

            putLastDraftOnTop("REDOLAST");
            
            io.sockets.emit("redo");

            startTheBidding();
        }

        else {
            io.sockets.emit("admin", socketToUser[socket.id] + " is trying to redo last round, but that hasn't happened yet");
        }
        
    });
    
    socket.on("redoall", function () {
        if (oldDrafts.length > 0) {
            var curDraft = oldDrafts.pop();
            console.log("REDOALL: putting current " + curDraft + " back on the stack");
            draftAndMinBid.unshift(curDraft);

            while (oldBids.length > 0) {
                refundLastBid("REDOALL");
            }

            while (oldDrafts.length > 0) {
                putLastDraftOnTop("REDOALL");
            }

            io.sockets.emit("redo");

            startTheBidding();
        }

        else {
            io.sockets.emit("admin", socketToUser[socket.id] + " is trying to redo everything but it's too early");
        }
    });
    
    socket.on("reload", function (clearUsers) {
        
        io.sockets.emit("redo"); //stop everything
        
        if (clearUsers) {
            userList.forEach(function (entry) {
                io.sockets.emit("setpoints", entry, 0);
                io.sockets.emit("clearteam", entry);
            });
        }
        
        io.sockets.emit("hidebid");
        
        biddingTime = false;
        topBid = 0;
        topBidUser = "";
        currentDrafter = "";
        minBid = 0;
        draftAndMinBid = [];
        oldDrafts = [];
        oldBids = [];

        data = fs.readFileSync("./draft/ListOfPokes.csv", "ascii");
        draftAndMinBid = data.split("\r\n");
    });
    
    socket.on("auto", function (newAuto) {
        autoNext = newAuto;
        var newAutoString = newAuto ? "on" : "off";
        console.log("ADMIN: turning auto " + newAutoString);
        io.sockets.emit("admin", "Auto has been turned " + newAutoString);
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
        topBidUser = "";
        topBid = 0;
        setDrafterAndMinBid();
        io.sockets.emit("chat", "Bidding on " + currentDrafter + " begins in 10 seconds!", "");
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
    oldDrafts.push(curEntry);
    var splitEntry = curEntry.split(",");

    currentDrafter = splitEntry[0];
    minBid = splitEntry[1];

    console.log("SETDRAFTERANDMIN: Grabbed \"" + currentDrafter + "\" for " + minBid);
}

function putLastDraftOnTop(whichRedo){
    var curDraft = oldDrafts.pop();
    console.log(whichRedo + ": putting " + curDraft + " back on the stack");
    draftAndMinBid.unshift(curDraft);
}

function refundLastBid(whichRedo){
    var prevBidTransaction = oldBids.pop();
    var prevBidSplit = prevBidTransaction.split(",");
    var prevBidder = prevBidSplit[0];
    var prevBid = prevBidSplit[1];
    console.log(whichRedo + ": refunding " + prevBid + " points to " + prevBidder);
    io.sockets.emit("addpoints", prevBidder, prevBid);
    console.log(whichRedo + ": removing draft member from " + prevBidder + "'s team");
    io.sockets.emit("setlastmember", prevBidder);
}
