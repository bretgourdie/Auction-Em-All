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
    
    // Connections
    socket.on('register', function (username, userList) {
        $("#user-list").text(userList.toString().replace(",", ", "));
        addChat(username, " has joined the room");
    });
    
    socket.on('disconnect', function (username, userList) {
        $("#user-list").text(userList.toString().replace(",", ", "));
        addChat(username, " has left the room.");
    });

    // Receiving chat
    socket.on('chat', function (bold, nonbold) {
        addChat(bold, nonbold);
    });
    
    /*socket.on("chat", function (msg) {
        addChat(msg);
    });*/
    
    // Bidding events
    socket.on('bid', function (topBidUser, topBid) {
        if (username == topBidUser) {
            addChat("You", " have bid " + topBid + "!");
        }
        else {
            addChat(topBidUser, " has bid " + topBid + "!");
        }
    });
    
    socket.on('bidstart', function () {
        addChat('10-second timer countdown starts here.');
    });
    
    socket.on('bidend', function (topBidUser) {
        if (username == topBidUser) {
            addChat("You won the bid!");
        }

        addChat("Stop the timer here.");
    });
}


// Determine if message is going to be sent, then send it through 'chat'
function handleMessageBox(){

    var msg = $('#message-box').val();
    
    if (msg) {
        // analyze message
        
        if (msg.lastIndexOf("/bidstart") == 0 || msg.lastIndexOf("/DARIUS") == 0) {
            socket.emit('bidstart');
        }

        // Kludge, take out when timer is working
        else if (msg.lastIndexOf("/bidend") == 0) {
            socket.emit('bidend');
        }

        else if (msg.lastIndexOf("/bid") == 0) {
            var bid = 1337;
            socket.emit('bid', username, bid);
        }

        else {
            socket.emit('chat', username, ": " + msg);
        }
        
        $('#message-box').val('');
        $('#message-box').focus();
    }

    return false;
}

function addChat(boldPart, regularMsg){
    $('#messages').append($('<b>').text(boldPart)).append(regularMsg).append($("<p>"));
}