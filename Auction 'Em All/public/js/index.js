var username = null

while (!username) {
    username = prompt("Please enter a user name.");
}

var socket = io();

socket.emit('register', username);

// Hitting enter key
$(document).keypress(function (e) {
    if (e.which == 13) { //enter key
        handleMessageBox();
    }
});
// Clicking "Send" Button
$('#send-message-btn').click(handleMessageBox());

// Receiving chat
socket.on('chat', function (msg) {
    addChat(msg);
});

socket.on('bid', function (topBidUser, topBid, msg) {
    addChat(msg);
});

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
            $('#messages').append($('<p>').text(usernameAndMessage));
        }
        
        $('#message-box').val('');
    }

    return false;
}

function addChat(msg){
    $('#messages').append($('<p>').text(msg));
}