var socket = io();
$(document).keypress(function (e) {
    if (e.which == 13) {
        handleMessageBox();
    }
});
$('#send-message-btn').click(handleMessageBox());
socket.on('chat', function (msg) {
    $('#messages').append($('<p>').text(msg));
});

function handleMessageBox(){
    var msg = $('#message-box').val();
    socket.emit('chat', msg);
    $('#messages').append($('<p>').text(msg));
    $('#message-box').val('');
    return false;
}