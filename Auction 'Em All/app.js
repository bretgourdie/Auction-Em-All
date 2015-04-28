
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var userList = [];
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
    console.log('Express server listening on port ' + app.get('port'));
});

io.on('connection', function (socket) {
    console.log('CONNECTION: a user connected');
    
    socket.on('register', function registerUser(username) {
        userList[socket.id] = username;
        console.log('REGISTER: ' + username);
        socket.broadcast.emit('chat', username + ' has entered the room.');
        
    });

    socket.on('disconnect', function () {
        var disconnectedUsername = userList[socket.id];
        userList.splice(socket.id, 1);
        console.log('CONNECTION: ' + disconnectedUsername + ' disconnected');
        socket.broadcast.emit('chat', disconnectedUsername + ' has left the room.');
    });

    socket.on('chat', function (msg) {
        console.log("CHAT: " + msg);
        socket.broadcast.emit('chat', msg);
    });

    socket.on('startbid', function () {
        console.log("STARTBID: Text goes here");
        socket.broadcast.emit('bid', 'Bidding begins in 10 seconds!');
    });

    socket.on('bid', function (user, bid) {
        if (biddingTime && bid > topBid) {
            topBid = bid;
            topBidUser = user;
            console.log("BID: " + user + ": " + bid);
            socket.broadcast.emit(user + " has bid " + bid + "!");
        }
        else {
            socket.emit('Someone bid before you. Try again!');
        }
    });

    /* Place to put more socket events */
});

