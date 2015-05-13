var username;
var currentTeam = [];
var admin = false;
var points = 0;
var myTeam = [];
var bidToBeat = 0;

var biddingIntervalId = null;
var restingIntervalId = null;

var biddingTimer;

var biddingTime = false;

username = prompt("Please enter a user name.");

if (username == null || username == "") {
    $("#titleheader").text("Reload the page and enter a name this time!");
}

else {
    var socket = io.connect("http://nodejs-auctionemall.rhcloud.com:8000");
    
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
    socket.on("bid", function (topBidUser, topBid) {
        if (username == topBidUser) {
            addChat("You", " have bid " + topBid + "!");
        }
        else {
            addChat(topBidUser, " has bid " + topBid + "!");
        }

        bidToBeat = topBid * 1 + 10;
        setBidButton(topBidUser);
        biddingTimer = Math.max(biddingTimer, 5); // Keep resetting at five
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
        startRestTimer();
        notifyMe(currentDrafter);
    });
    
    socket.on("endbid", function (topBidUser, topBid, biddedThing) {
        if (username == topBidUser) {
            
            myTeam.push(biddedThing);
            
            updateTeam(myTeam);

            points -= topBid;

            updatePoints(points);
        }
        
        clearInterval(restingIntervalId);
        
        resolveBidding();
        

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
            sayNotAuth("becoming an admin");
        }
        
    });

    socket.on("setpoints", function (userToGive, numPoints) {
        
        if (username == userToGive) {
            points = numPoints;
            updatePoints(points);
            setBidButton();
            addChat("Bidding points set to " + numPoints + "!");
            socket.emit("admin", "Confirmed setting " + username + "'s points to " + numPoints);
        }
    });
    
    socket.on("clearteam", function (userToClear) {
        if (username == userToClear) {
            myTeam = [];
            updateTeam(myTeam);
            
            addChat("Your team has been cleared!");
        }
    });
    
    socket.on("hidebid", function (){
        $("#bid-div").hide();
    })
    
    socket.on("addpoints", function (userToGive, numPoints) {
        if (username == userToGive) {
            points += numPoints * 1;
            updatePoints(points);
            setBidButton();

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
    
    socket.on("peekpoints", function (userToPeek) {
        if (username == userToPeek) {
            socket.emit("admin", userToPeek + " has " + points + " points");
        }
    });
    
    socket.on("redo", function () {
        clearInterval(biddingIntervalId);
        clearInterval(restingIntervalId);
        biddingTime = false;
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
        
        if (msg.lastIndexOf("/startbid") == 0 || msg.lastIndexOf("/DARIUS") == 0) {
            if (admin) {
                socket.emit("startbid");
            }
            else {
                sayNotAuth("starting the bidding round");
            }
        }

        else if (msg.lastIndexOf("/endbid") == 0) {
            if (admin) {
                socket.emit("endbid");
            }
            else {
                sayNotAuth("ending the bidding round");
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
                sayNotAuth("changing someone's points");
            }
            
        }

        else if (msg.lastIndexOf("/auto off") == 0) {
            if (admin) {
                socket.emit("auto", false);
            }

            else {
                sayNotAuth("setting auto-round mode");
            }
        }

        else if (msg.lastIndexOf("/auto on") == 0){
            if (admin) {
                socket.emit("auto", true);
            }

            else {
                sayNotAuth("setting auto-round mode");
            }
        }

        else if (msg.lastIndexOf("/peekpoints") == 0) {
            if (admin) {
                var splitMsg = msg.split(" ");
                var userToPeek = splitMsg[1];

                socket.emit("peekpoints", userToPeek);
            }

            else {
                sayNotAuth("looking at someone's points");
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
                sayNotAuth("adjusting drafted members");
            }
        }

        else if (msg.lastIndexOf("/redo current") == 0) {
            if (admin) {
                socket.emit("admin", username + " redoing the current round");
                socket.emit("redocurrent");
            }

            else {
                sayNotAuth("redoing the current round");
            }
        }

        else if (msg.lastIndexOf("/redo last") == 0) {
            if (admin) {
                socket.emit("admin", username + " redoing the last round");
                socket.emit("redolast");
            }

            else {
                sayNotAuth("redoing the last round");
            }
        }

        else if (msg.lastIndexOf("/redo all") == 0) {
            if (admin) {
                socket.emit("admin", username + " redoing the whole draft!");
                socket.emit("redoall");
            }

            else {
                sayNotAuth("redoing the whole draft");
            }
        }

        else if (msg.lastIndexOf("/redo") == 0) {
            if (admin) {
                addChat("Admin Note:", " Which round are you redoing (last or current)?");
            }

            else {
                sayNotAuth("redoing a round");
            }
        }

        else if (msg.lastIndexOf("/reload clear") == 0) {
            if (admin) {
                socket.emit("admin", username + " is starting over from scratch");
                socket.emit("reload", true);
            }

            else {
                sayNotAuth("reloading everything");
            }
        }

        else if (msg.lastIndexOf("/reload") == 0) {
            if (admin) {
                socket.emit("admin", username + " is reloading the roster");
                socket.emit("reload", false);
            }

            else {
                sayNotAuth("reloading the roster")
            }
        }

        else if (msg.lastIndexOf("/endall") == 0) {
            if (admin) {
                socket.emit("admin", username + " ending the draft prematurely...");
                socket.emit("endall");
            }

            else {
                sayNotAuth("ending the whole draft");
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

function sayNotAuth(functionAttempted){
    addChat("You are not authorized for " + functionAttempted + "...", "");
}

function updatePoints(numPoints){
    $("#num-points").text(numPoints);
}

function updateTeam(newTeam){
    var displayTeam = newTeam.join(", ");
    
    if (newTeam.length == 0) {
        displayTeam = "None";
    }

    $("#my-team").text(displayTeam);
}

function setBidButton(topBidUser){

    $("#bid-button").prop("disabled", true);

    setTimeout(function () {
        $("#bid-button").prop("disabled", (points * 1 < bidToBeat * 1) || !biddingTime || (username == topBidUser));
    }, 500);
	
	console.log("Setting Bid button to " + bidToBeat);

    $("#bid-button").text("Bid " + bidToBeat);
}

function startRestTimer() {
    var timer = 10, minutes, seconds;
    restingIntervalId = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);
        
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        
        $("#bid-timer").text(minutes + ":" + seconds);
        $("#bid-timer").css("color", "black");

        timer--;

        if (timer < 0) {
            allowBidding();
        }
    }, 1000);
}

function startBiddingTimer(){
    biddingTimer = 20;
    var minutes, seconds;
    biddingIntervalId = setInterval(function () {
        minutes = parseInt(biddingTimer / 60, 10);
        seconds = parseInt(biddingTimer % 60, 10);
        
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
        
        $("#bid-timer").text(minutes + ":" + seconds)
        var newColor = biddingTimer <= 5 ? "red" : "black";
        $("#bid-timer").css("color", newColor);
        
        biddingTimer--;

        if (biddingTimer < 0) {
            resolveBidding();
            socket.emit("endbidindividual");
        }
    }, 1000);
}

function allowBidding(){
    startBiddingTimer();
    biddingTime = true;
    clearInterval(restingIntervalId);
    $("#bid-message").text("Bidding on:");
    $("#bid-timer-message").text("Place your bids!");
    addChat("Start bidding on ", $("#bidding-on").html() + "!");
    setBidButton();
}

function resolveBidding(){
    clearInterval(biddingIntervalId);
    biddingTime = false;
    $("#bid-message").text("Waiting to bid on:");
    $("#bid-timer-message").text("Waiting for next round...");
}

function notifyMe(currentDrafter) {
    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
        //alert("This browser does not support desktop notification");
        // ignore
    }

  // Let's check whether notification permissions have alredy been granted
    else if (Notification.permission === "granted") {
        // If it's okay let's create a notification
        var notification = new Notification("Bidding on " + currentDrafter + " in 10 seconds!");
    }

  // Otherwise, we need to ask the user for permission
    else if (Notification.permission !== 'denied') {
        Notification.requestPermission(function (permission) {
            // If the user accepts, let's create a notification
            if (permission === "granted") {
                var notification = new Notification("Bidding on " + currentDrafter + " in 10 seconds!");
            }
        });
    }
}
