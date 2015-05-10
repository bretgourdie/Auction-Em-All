var username;
var currentTeam = [];
var admin = false;
var points = 0;
var myTeam = [];
var bidToBeat = 0;

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
        $("#user-list").text(userList.join(", "));
        addChat(username, " has joined the room");
    });
    
    socket.on("getUserList", function (userList) {
        $("#user-list").text(userList.join(", "));
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

        bidToBeat = topBid * 1 + 10;
        setBidButton();
    });
    
    socket.on("startbid", function (currentDrafter, minBid) {
        $("#bid-div").show();
        $("#bidding-on").html("<a href='http://www.smogon.com/dex/xy/pokemon/" 
            + currentDrafter.toLowerCase() 
            + "' target='_blank'>" 
            + currentDrafter 
            + "</a>");
        
        bidToBeat = minBid;
        
        setBidButton();

        addChat("10-second timer countdown starts here.");
    });
    
    socket.on("endbid", function (topBidUser, topBid, biddedThing) {
        if (username == topBidUser) {
            
            myTeam.push(biddedThing);
            
            updateTeam(myTeam);

            points -= topBid;

            updatePoints(points);
        }

        addChat("Stop the timer here.", "");

        socket.emit("checkin");
    });
    
    socket.on("requestCheckin", function () {
        socket.emit("checkin");
    });
    
    socket.on("donebid", function () {
        addChat("The draft has concluded! Thank you for participating!", "");
        socket.emit("admin", username + ": " + myTeam.join(", "));
        $("#bid-div").hide();
    });
    
    // Privileged Events
    socket.on("admin", function (msg) {
        if (admin) {
            addChat("Admin Note: ", msg);
        }
    });

    socket.on("promote", function (result) {
        if (!admin && result) {
            admin = true;
            socket.emit("admin", username + " promoted to admin");
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
    
    socket.on("addpoints", function (userToGive, numPoints) {
        if (username == userToGive) {
            points += numPoints * 1;
            updatePoints(points);
            
            if (numPoints > 0) {
                addChat("You got " + numPoints + " more points for a total of " + points + "!");
                socket.emit("admin", "Confirmed adding " + numPoints + " points to " + username + " for a total of " + points + " points");
            }

            else if (numPoints < 0) {
                addChat("You lost " + (numPoints * -1) + " points for a total of " + points + "...");
                socket.emit("admin", "Confirmed subtracting " + (numPoints * -1) + " points from " + username + " for a total of " + points + " points");
            }
        }
    });

    socket.on("setlastmember", function (userToSet, teammate) {

        if (username == userToSet) {
            
            // take away last teammate
            if (teammate == null || teammate == "") {

                if (myTeam.length == 0) {
                    // No team to pop
                    addChat("Some idiot admin", " is trying to mess with your nonexistent team.");
                    socket.emit("admin", userToSet + " has no team!");
                }

                else {
                    var poppedTeammate = myTeam.pop();
                    addChat("Admins took away your " + poppedTeammate + "...", "");
                    socket.emit("admin", userToSet + " lost " + poppedTeammate);
                }
            }

            // give whatever teammate was supplied
            else {
                myTeam.push(teammate);
                addChat("Admins granted you " + teammate + "!", "");
                socket.emit("admin", userToSet + " gained " + teammate);
            }

            updateTeam(myTeam);
        }
    });

    
    $("#message-box").focus();
}


// Determine if message is going to be sent, then send it through 'chat'
function handleMessageBox(){

    var msg = $("#message-box").val();
    
    if (msg) {
        // analyze message
        
        if (msg.lastIndexOf("/startbid") == 0) {
            if (admin) {
                socket.emit("startbid");
            }
            else {
                sayNotAuth();
            }
        }

        else if (msg.lastIndexOf("/startall") == 0 || msg.lastIndexOf("/DARIUS") == 0) {
            if (admin) {
                socket.emit("startall");
            }

            else {
                sayNotAuth();
            }
        }

        // Kludge, take out when timer is working
        else if (msg.lastIndexOf("/endbid") == 0) {
            if (admin) {
                socket.emit("endbid");
            }
            else {
                sayNotAuth();
            }
        }

        else if (msg.lastIndexOf("/bid") == 0) {
            if (points >= bidToBeat) {
                handleBid();
            }
        }

        else if (msg.lastIndexOf("/promote") == 0) {
            var splitMsg = msg.split(" ");
            var password = splitMsg[1];
            socket.emit("promote", password);            
        }

        else if (msg.lastIndexOf("/setpoints") == 0 || msg.lastIndexOf("/addpoints") == 0) {
            if (admin) {
                var splitMsg = msg.split(" ");
                var userToGive = splitMsg[1];
                var numPoints = splitMsg[2];
                
                if (!isNaN(numPoints)) {

                    socket.emit(splitMsg[0].replace("/",""), userToGive, numPoints);
                }

                else {
                    addChat("Admin Note: ", "\"" + numPoints + "\" is not a number!");
                }
            }

            else {
                sayNotAuth();
            }
            
        }

        else if (msg.lastIndexOf("/setlastmember") == 0) {
            if (admin) {
                var splitMsg = msg.split(" ");
                var userToSet = splitMsg[1];
                var teammate = splitMsg[2];

                socket.emit("setlastmember", userToSet, teammate);
            }

            else {
                sayNotAuth();
            }
        }

        else if (msg.lastIndexOf("/endall") == 0) {
            if (admin) {
                socket.emit("admin", username + " ending the draft prematurely...");
                socket.emit("endall");
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
    socket.emit("bid", username, bidToBeat);
}

function addChat(boldPart, regularMsg){
    $("#messages").append($("<b>").text(boldPart)).append(regularMsg).append($("<p>"));
    $("#messages").animate({ scrollTop: $("#messages")[0].scrollHeight }, 1000);
}

function sayNotAuth(){
    addChat("You are not authorized for that function...", "");
}

function updatePoints(numPoints){
    $("#num-points").text(numPoints);
}

function updateTeam(newTeam){
    $("#my-team").text(newTeam.join(", "));
}

function setBidButton(){

    $("#bid-button").prop("disabled", points < bidToBeat);

    $("#bid-button").text("Bid " + bidToBeat);
}
