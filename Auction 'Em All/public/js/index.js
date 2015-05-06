var username;
var currentTeam = [];
var admin = false;
var points = 0;

username = prompt("Please enter a user name.");

if (username == null || username == "") {
    $("#titleheader").text("Reload the page and enter a name this time!");
}

else {
    var socket = io();
    
    socket.emit("register", username);
    
    $("#titleheader").append(", " + username + "!");
    
    // Hitting enter key
    $(document).keypress(function (e) {
        var enterKey = 13;

        if (e.which == enterKey 
            && $("#message-box").is(":focus")) {
            handleMessageBox();
        }
    });
    // Clicking "Send" Button
    $('#send-message-btn').click(function () {
        handleMessageBox();
    });
    
    // Clicking "Bid" Button
    $("#bid-button").click(function () {
        handleBid();
    });
    
    // Connections
    socket.on('register', function (username, userList) {
        $("#user-list").text(userList.toString().replace(/,/g, ", "));
        addChat(username, " has joined the room");
    });
    
    socket.on('disconnect', function (username, userList) {
        $("#user-list").text(userList.toString().replace(/,/g, ", "));
        addChat(username, " has left the room.");
    });

    // Receiving chat
    socket.on('chat', function (bold, nonbold) {
        addChat(bold, nonbold);
    });
    
    // Bidding events
    socket.on('bid', function (topBidUser, topBid) {
        if (username == topBidUser) {
            addChat("You", " have bid " + topBid + "!");
        }
        else {
            addChat(topBidUser, " has bid " + topBid + "!");
        }
    });
    
    socket.on("bidstart", function () {
        $("#bid-div").show();
        addChat("10-second timer countdown starts here.");
    });
    
    socket.on("bidend", function (topBidUser) {
        if (username == topBidUser) {
            addChat("You won the bid!", "");
        }

        addChat("Stop the timer here.", "");
    });
    
    socket.on("admin", function (msg) {
        if (admin) {
            addChat("Admin Note: ", msg);
        }
    });

    socket.on("promote", function (result) {
        if (!admin && result) {
            admin = true;
            addChat("Admin status granted!", "");
        }

        else if (!result) {
            sayNotAuth();
        }
        
    });

    socket.on("setpoints", function (userToGive, numPoints) {
        
        if (username == userToGive) {
            points = numPoints;
            updatePoints(points);
            addChat("Bidding points set to " + numPoints + "!");
            socket.emit("admin", "Confirmed setting " + username + "'s points to " + numPoints);
        }
    });
}


// Determine if message is going to be sent, then send it through 'chat'
function handleMessageBox(){

    var msg = $("#message-box").val();
    
    if (msg) {
        // analyze message
        
        if (msg.lastIndexOf("/bidstart") == 0 || msg.lastIndexOf("/DARIUS") == 0) {
            socket.emit("bidstart");
        }

        // Kludge, take out when timer is working
        else if (msg.lastIndexOf("/bidend") == 0) {
            socket.emit("bidend");
        }

        else if (msg.lastIndexOf("/bid") == 0) {
            handleBid();
        }

        else if (msg.lastIndexOf("/promote") == 0) {
            var splitMsg = msg.split(" ");
            var password = splitMsg[1];
            socket.emit("promote", password);            
        }

        else if (msg.lastIndexOf("/setpoints") == 0) {
            if (admin) {
                var splitMsg = msg.split(" ");
                var userToGive = splitMsg[1];
                var numPoints = splitMsg[2];
                
                if (!isNaN(numPoints)) {

                    socket.emit("setpoints", userToGive, numPoints);
                }

                else {
                    addChat("Admin Note: ", "\"" + numPoints + "\" is not a number!");
                }
            }

            else {
                sayNotAuth();
            }
            
        }

        else {
            socket.emit("chat", username, ": " + msg);
        }
        
        $("#message-box").val("");
        $("#message-box").focus();
    }

    return false;
}

function handleBid(){
    var bid = 1337;
    socket.emit("bid", username, bid);
}

function addChat(boldPart, regularMsg){
    $("#messages").append($("<b>").text(boldPart)).append(regularMsg).append($("<p>"));
}

function sayNotAuth(){
    addChat("You are not authorized for that function...", "");
}

function updatePoints(numPoints){
    $("#num-points").text(numPoints);
}