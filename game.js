

const SUPABASE_URL =
    "https://cumwoqdzpsidocqvulxd.supabase.co/";

const SUPABASE_KEY =
    "sb_publishable_1ibhlNKv4SuESO57U1FJGw_s208R7FI";


/* =========================================
   SUPABASE
========================================= */

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================
   GAME VARIABLES
========================================= */

let roomCode = null;

let playerId =
    crypto.randomUUID();

let playerName = "";

let channel = null;

let isHost = false;

let gameState = null;

let pendingCardIndex = null;


/* =========================================
   COLORS
========================================= */

const COLORS = [
    "red",
    "yellow",
    "green",
    "blue"
];


/* =========================================
   HELPERS
========================================= */

const $ =
    id => document.getElementById(id);


function showScreen(id) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {

            screen.classList.remove(
                "active"
            );

        });


    $(id).classList.add("active");
}


function toast(message) {

    const element =
        $("toast");

    element.textContent =
        message;

    element.style.display =
        "block";


    clearTimeout(
        window.toastTimer
    );


    window.toastTimer =
        setTimeout(() => {

            element.style.display =
                "none";

        }, 2500);
}


function generateRoomCode() {

    return Math
        .random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
}


function escapeHTML(text) {

    return text.replace(
        /[&<>"']/g,
        character => {

            const replacements = {

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return replacements[
                character
            ];
        }
    );
}


/* =========================================
   CREATE ROOM
========================================= */

$("create").onclick =
    async function () {

        playerName =
            $("name")
                .value
                .trim();


        if (!playerName) {

            toast(
                "Enter your name first."
            );

            return;
        }


        playerName =
            playerName.substring(
                0,
                15
            );


        roomCode =
            generateRoomCode();


        isHost = true;


        await connectToRoom();


        broadcast({

            type: "ROOM_CREATED",

            player: {

                id: playerId,

                name: playerName
            }
        });


        showScreen(
            "lobby"
        );
    };


/* =========================================
   JOIN ROOM
========================================= */

$("join").onclick =
    async function () {

        playerName =
            $("name")
                .value
                .trim();


        roomCode =
            $("code")
                .value
                .trim()
                .toUpperCase();


        if (!playerName) {

            toast(
                "Enter your name."
            );

            return;
        }


        if (
            roomCode.length < 4
        ) {

            toast(
                "Enter a valid room code."
            );

            return;
        }


        isHost = false;


        await connectToRoom();


        broadcast({

            type: "PLAYER_JOIN",

            player: {

                id: playerId,

                name: playerName
            }
        });


        showScreen(
            "lobby"
        );
    };


/* =========================================
   CONNECT TO SUPABASE ROOM
========================================= */

async function connectToRoom() {

    if (channel) {

        await supabaseClient
            .removeChannel(
                channel
            );
    }


    channel =
        supabaseClient.channel(
            "uno-room-" +
            roomCode,
            {

                config: {

                    broadcast: {
                        self: false
                    },

                    presence: {
                        key: playerId
                    }
                }
            }
        );


    channel.on(

        "broadcast",

        {
            event: "game"
        },

        payload => {

            handleMessage(
                payload.payload
            );
        }

    );


    channel.on(

        "presence",

        {
            event: "sync"
        },

        () => {

            renderPresence();
        }

    );


    const result =
        await channel.subscribe(
            async status => {

                if (
                    status ===
                    "SUBSCRIBED"
                ) {

                    await channel.track({

                        id: playerId,

                        name: playerName
                    });


                    renderLobby();
                }

            }
        );


    return result;
}


/* =========================================
   BROADCAST
========================================= */

async function broadcast(
    message
) {

    if (!channel)
        return;


    await channel.send({

        type: "broadcast",

        event: "game",

        payload: message
    });
}


/* =========================================
   PRESENCE
========================================= */

function getPlayers() {

    if (!channel)
        return [];


    const presence =
        channel.presenceState();


    const players = [];


    Object
        .values(presence)
        .forEach(list => {

            list.forEach(player => {

                if (
                    !players.some(
                        p =>
                            p.id ===
                            player.id
                    )
                ) {

                    players.push(
                        player
                    );
                }

            });

        });


    return players;
}


function renderPresence() {

    renderLobby();
}


/* =========================================
   LOBBY
========================================= */

function renderLobby() {

    if (!roomCode)
        return;


    $("roomCode")
        .textContent =
        roomCode;


    const players =
        getPlayers();


    $("count")
        .textContent =
        `(${players.length}/6)`;


    $("players")
        .innerHTML =
        players
            .map(
                (player, index) => `

                    <div class="player">

                        <span>
                            ${
                                index === 0
                                    ? "👑"
                                    : "👤"
                            }

                            ${escapeHTML(
                                player.name
                            )}
                        </span>

                        <span>
                            ${
                                index === 0
                                    ? "Host"
                                    : ""
                            }
                        </span>

                    </div>

                `
            )
            .join("");


    $("start")
        .style.display =
        isHost
            ? "block"
            : "none";
}


/* =========================================
   START BUTTON
========================================= */

$("start").onclick =
    function () {

        const players =
            getPlayers();


        if (
            players.length < 2
        ) {

            toast(
                "You need at least 2 players."
            );

            return;
        }


        if (
            players.length > 6
        ) {

            toast(
                "Maximum 6 players."
            );

            return;
        }


        createGame(
            players
        );
    };


/* =========================================
   CREATE GAME
========================================= */

function createGame(
    players
) {

    const deck =
        createDeck();


    shuffle(deck);


    const hands =
        {};


    players.forEach(
        player => {

            hands[player.id] = [];

        }
    );


    /*
       Deal 7 cards
    */

    for (
        let i = 0;
        i < 7;
        i++
    ) {

        players.forEach(
            player => {

                hands[player.id]
                    .push(
                        deck.pop()
                    );

            }
        );
    }


    /*
       First discard card
    */

    let firstCard;


    do {

        firstCard =
            deck.pop();

        if (
            firstCard.type ===
                "wild" ||
            firstCard.type ===
                "wild4"
        ) {

            deck.unshift(
                firstCard
            );
        }

    } while (
        firstCard.type ===
            "wild" ||
        firstCard.type ===
            "wild4"
    );


    gameState = {

        started: true,

        players: players,

        hands: hands,

        deck: deck,

        discard: [
            firstCard
        ],

        currentPlayer: 0,

        direction: 1,

        currentColor:
            firstCard.color
    };


    broadcast({

        type: "GAME_STATE",

        state: gameState
    });


    renderGame();
}


/* =========================================
   DECK
========================================= */

function createDeck() {

    const deck = [];


    COLORS.forEach(
        color => {

            deck.push({

                color,

                value: "0",

                type: "number"
            });


            for (
                let number = 1;
                number <= 9;
                number++
            ) {

                deck.push({

                    color,

                    value:
                        String(number),

                    type:
                        "number"
                });


                deck.push({

                    color,

                    value:
                        String(number),

                    type:
                        "number"
                });
            }


            [
                "skip",
                "reverse",
                "+2"
            ].forEach(
                action => {

                    deck.push({

                        color,

                        value:
                            action,

                        type:
                            "action"
                    });


                    deck.push({

                        color,

                        value:
                            action,

                        type:
                            "action"
                    });

                }
            );

        }
    );


    for (
        let i = 0;
        i < 4;
        i++
    ) {

        deck.push({

            color: "wild",

            value: "WILD",

            type: "wild"
        });


        deck.push({

            color: "wild",

            value: "+4",

            type: "wild4"
        });
    }


    return deck;
}


/* =========================================
   SHUFFLE
========================================= */

function shuffle(deck) {

    for (
        let i = deck.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            deck[i],
            deck[j]
        ] =
        [
            deck[j],
            deck[i]
        ];
    }
}


/* =========================================
   MESSAGE HANDLER
========================================= */

function handleMessage(
    message
) {

    if (!message)
        return;


    if (
        message.type ===
        "PLAYER_JOIN"
    ) {

        renderLobby();

        return;
    }


    if (
        message.type ===
        "GAME_STATE"
    ) {

        gameState =
            message.state;


        renderGame();


        showScreen(
            "game"
        );

        return;
    }


    if (
        message.type ===
        "PLAY_CARD"
    ) {

        processPlay(
            message
        );

        return;
    }


    if (
        message.type ===
        "DRAW_CARD"
    ) {

        processDraw(
            message
        );

        return;
    }


    if (
        message.type ===
        "WINNER"
    ) {

        toast(
            "🎉 " +
            message.name +
            " wins!"
        );

    }
}


/* =========================================
   CARD VALIDATION
========================================= */

function canPlay(
    card
) {

    const top =
        gameState
            .discard[
                gameState
                    .discard
                    .length - 1
            ];


    if (
        card.type ===
            "wild" ||
        card.type ===
            "wild4"
    ) {

        return true;
    }


    if (
        card.color ===
        gameState.currentColor
    ) {

        return true;
    }


    if (
        card.value ===
        top.value
    ) {

        return true;
    }


    return false;
}


/* =========================================
   PLAY CARD
========================================= */

function playCard(
    index
) {

    const myIndex =
        gameState.players
            .findIndex(
                player =>
                    player.id ===
                    playerId
            );


    if (
        myIndex !==
        gameState.currentPlayer
    ) {

        toast(
            "It's not your turn."
        );

        return;
    }


    const hand =
        gameState
            .hands[playerId];


    const card =
        hand[index];


    if (!card)
        return;


    if (
        !canPlay(card)
    ) {

        toast(
            "You can't play that card."
        );

        return;
    }


    if (
        card.type === "wild" ||
        card.type === "wild4"
    ) {

        pendingCardIndex =
            index;


        $("modal")
            .classList
            .remove("hidden");


        return;
    }


    broadcast({

        type: "PLAY_CARD",

        playerId,

        index,

        chosenColor:
            card.color
    });
}


/* =========================================
   PROCESS PLAY
========================================= */

function processPlay(
    message
) {

    if (!gameState)
        return;


    const playerIndex =
        gameState.players
            .findIndex(
                player =>
                    player.id ===
                    message.playerId
            );


    if (
        playerIndex !==
        gameState.currentPlayer
    ) {

        return;
    }


    const hand =
        gameState
            .hands[
                message.playerId
            ];


    const card =
        hand[
            message.index
        ];


    if (!card)
        return;


    if (
        !canPlay(card)
    )
        return;


    hand.splice(
        message.index,
        1
    );


    gameState
        .discard
        .push(card);


    gameState.currentColor =
        message.chosenColor ||
        card.color;


    /*
       Winner
    */

    if (
        hand.length === 0
    ) {

        gameState.started =
            false;


        broadcast({

            type: "WINNER",

            name:
                gameState
                    .players[
                        playerIndex
                    ].name
        });


        renderGame();

        return;
    }


    /*
       +2
    */

    if (
        card.value === "+2"
    ) {

        drawForNextPlayer(2);

        advanceTurn(2);

        broadcastState();

        return;
    }


    /*
       +4
    */

    if (
        card.value === "+4"
    ) {

        drawForNextPlayer(4);

        advanceTurn(2);

        broadcastState();

        return;
    }


    /*
       Skip
    */

    if (
        card.value === "skip"
    ) {

        advanceTurn(2);

        broadcastState();

        return;
    }


    /*
       Reverse
    */

    if (
        card.value ===
        "reverse"
    ) {

        if (
            gameState.players
                .length === 2
        ) {

            advanceTurn(2);

        } else {

            gameState.direction *= -1;

            advanceTurn(1);
        }


        broadcastState();

        return;
    }


    /*
       Normal card
    */

    advanceTurn(1);

    broadcastState();
}


/* =========================================
   DRAW
========================================= */

function drawCard() {

    const myIndex =
        gameState.players
            .findIndex(
                player =>
                    player.id ===
                    playerId
            );


    if (
        myIndex !==
        gameState.currentPlayer
    ) {

        toast(
            "It's not your turn."
        );

        return;
    }


    broadcast({

        type: "DRAW_CARD",

        playerId
    });
}


/* =========================================
   PROCESS DRAW
========================================= */

function processDraw(
    message
) {

    const playerIndex =
        gameState.players
            .findIndex(
                player =>
                    player.id ===
                    message.playerId
            );


    if (
        playerIndex !==
        gameState.currentPlayer
    ) {

        return;
    }


    refillDeck();


    if (
        gameState.deck.length
    ) {

        gameState
            .hands[
                message.playerId
            ]
            .push(
                gameState.deck.pop()
            );
    }


    advanceTurn(1);


    broadcastState();
}


/* =========================================
   DRAW PENALTY
========================================= */

function drawForNextPlayer(
    amount
) {

    const next =
        getNextIndex(1);


    const player =
        gameState.players[
            next
        ];


    for (
        let i = 0;
        i < amount;
        i++
    ) {

        refillDeck();


        if (
            gameState.deck.length
        ) {

            gameState
                .hands[
                    player.id
                ]
                .push(
                    gameState.deck.pop()
                );
        }
    }
}


/* =========================================
   REFILL DECK
========================================= */

function refillDeck() {

    if (
        gameState.deck.length
    )
        return;


    if (
        gameState.discard.length <= 1
    )
        return;


    const top =
        gameState
            .discard
            .pop();


    gameState.deck =
        gameState
            .discard
            .splice(0);


    shuffle(
        gameState.deck
    );


    gameState.discard = [
        top
    ];
}


/* =========================================
   NEXT PLAYER
========================================= */

function getNextIndex(
    steps
) {

    const count =
        gameState.players
            .length;


    return (
        gameState.currentPlayer +
        gameState.direction *
        steps +
        count
    ) % count;
}


function advanceTurn(
    steps
) {

    gameState.currentPlayer =
        getNextIndex(
            steps
        );
}


/* =========================================
   BROADCAST STATE
========================================= */

function broadcastState() {

    broadcast({

        type: "GAME_STATE",

        state: gameState
    });
}


/* =========================================
   RENDER GAME
========================================= */

function renderGame() {

    if (!gameState)
        return;


    const myIndex =
        gameState.players
            .findIndex(
                player =>
                    player.id ===
                    playerId
            );


    const myTurn =
        myIndex ===
        gameState.currentPlayer;


    if (myTurn) {

        $("turn")
            .textContent =
            "🔥 YOUR TURN";

    } else {

        $("turn")
            .textContent =
            "Turn: " +
            gameState
                .players[
                    gameState
                        .currentPlayer
                ]
                .name;
    }


    $("color")
        .textContent =
        "Color: " +
        gameState
            .currentColor
            .toUpperCase();


    /*
       Players
    */

    $("opponents")
        .innerHTML =
        gameState.players
            .map(
                (player, index) => `

                    <div class="
                        opp
                        ${
                            index ===
                            gameState
                                .currentPlayer
                                ? "active"
                                : ""
                        }
                    ">

                        ${escapeHTML(
                            player.name
                        )}

                        ·

                        ${
                            gameState
                                .hands[
                                    player.id
                                ]
                                .length
                        }

                        🃏

                    </div>

                `
            )
            .join("");


    /*
       Top card
    */

    const top =
        gameState
            .discard[
                gameState
                    .discard
                    .length - 1
            ];


    $("topCard")
        .className =
        "card " +
        top.color;


    $("topCard")
        .textContent =
        top.value;


    /*
       My hand
    */

    const myHand =
        gameState
            .hands[playerId] ||
            [];


    $("hand")
        .innerHTML = "";


    myHand.forEach(
        (card, index) => {

            const button =
                document
                    .createElement(
                        "button"
                    );


            const playable =
                myTurn &&
                canPlay(card);


            button.className =
                "card " +
                card.color +
                (
                    playable
                        ? ""
                        : " disabled"
                );


            button.textContent =
                card.value;


            button.onclick =
                () => {

                    if (!playable) {

                        toast(
                            myTurn
                                ? "You can't play that card."
                                : "Wait for your turn."
                        );

                        return;
                    }


                    playCard(index);
                };


            $("hand")
                .appendChild(
                    button
                );

        }
    );
}


/* =========================================
   COLOR SELECTION
========================================= */

document
    .querySelectorAll(
        ".modal-box button"
    )
    .forEach(
        button => {

            button.onclick =
                () => {

                    if (
                        pendingCardIndex ===
                        null
                    )
                        return;


                    const color =
                        button.dataset
                            .color;


                    $("modal")
                        .classList
                        .add(
                            "hidden"
                        );


                    broadcast({

                        type:
                            "PLAY_CARD",

                        playerId,

                        index:
                            pendingCardIndex,

                        chosenColor:
                            color
                    });


                    pendingCardIndex =
                        null;
                };
        }
    );


/* =========================================
   COPY ROOM CODE
========================================= */

$("copy").onclick =
    async () => {

        try {

            await navigator
                .clipboard
                .writeText(
                    roomCode
                );


            toast(
                "Room code copied!"
            );

        } catch {

            toast(
                "Room code: " +
                roomCode
            );
        }
    };


/* =========================================
   LEAVE
========================================= */

$("leave").onclick =
    async () => {

        if (channel) {

            await channel
                .untrack();

            await supabaseClient
                .removeChannel(
                    channel
                );
        }


        location.reload();
    };


/* =========================================
   DRAW BUTTON
========================================= */

$("draw").onclick =
    drawCard;


$("drawPile").onclick =
    drawCard;


/* =========================================
   UNO BUTTON
========================================= */

$("uno").onclick =
    () => {

        if (!gameState)
            return;


        const hand =
            gameState
                .hands[playerId] ||
            [];


        if (
            hand.length === 1
        ) {

            toast(
                "🔥 UNO!"
            );

        } else {

            toast(
                "You can call UNO when you have one card left."
            );
        }
    };
