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
    $('#messages').append($('<p>').text(msg));
});

// Determine if message is going to be sent, then send it through 'chat'
function handleMessageBox(){
    var msg = $('#message-box').val();
    
    alert(msg);
    
    if (msg) {
        var usernameAndMessage = username + ": " + msg;
        socket.emit('chat', usernameAndMessage);
        $('#messages').append($('<p>').text(usernameAndMessage));
        $('#message-box').val('');
    }

    return false;
}