var username;

username = prompt("Please enter a user name.");

if (username == null || username == '') {
    $('#titleheader').text("Reload the page and enter a name this time!");
}

else {
    var socket = io();
    
    socket.emit('register', username);
    
    $('#titleheader').append(', ' + username + '!');
    
    // Hitting enter key
    $(document).keypress(function (e) {
        var enterKey = 13;

        if (e.which == enterKey 
            && $('#message-box').is(':focus')) {
            handleMessageBox();
        }
    });
    // Clicking "Send" Button
    $('#send-message-btn').click(function () {
        handleMessageBox();
    });
    
    // Receiving chat
    socket.on('chat', function (msg) {
        addChat(msg);
    });
    
    socket.on('bid', function (topBidUser, topBid) {
        if (username == topBidUser) {
            addChat('You have bid ' + topBid + "!");
        }
        else {
            addChat(topBidUser + " has bid " + topBid + "!");
        }
    });
    
    socket.on('startbid', function () {
        addChat('10-second timer countdown starts here.');
    });
    
    socket.on('endbid', function (topBidUser, topBid) {
        if (username == topBidUser) {
            addchat("You won with your bid of " + topBid.toString() + "!");
        }
        else {
            addchat(topBidUser + " has won with a bid of " + topBid.toString() + "!")
        }
    });
}


// Determine if message is going to be sent, then send it through 'chat'
function handleMessageBox(){

    var msg = $('#message-box').val();
    
    if (msg) {
        // analyze message
        
        if (msg.lastIndexOf("/bid") == 0) {
            var bid = 1337;
            socket.emit('bid', username, bid);
        }

        else if (msg.lastIndexOf("/startbid") == 0) {
            socket.emit('startbid');
        }

        // Kludge, take out when timer is working
        else if (msg.lastIndexOf("/endbid") == 0) {
            socket.emit('endbid');
        }

        else {
            var usernameAndMessage = username + ": " + msg;
            socket.emit('chat', usernameAndMessage);
        }
        
        $('#message-box').val('');
        $('#message-box').focus();
    }

    return false;
}

function addChat(msg){
    $('#messages').append($('<p>').text(msg));
}