// Between Us — adapted to the Yours, Watching envelope structure.
// 5 days × 2 envelopes (morning + evening) = 10 envelopes.

window.GAME_CONTENT = {
  prologue: {
    lines: [
      "Five days. Ten envelopes. A story written for you alone.",
      "Each morning and each evening, a sealed letter arrives.",
      "Your choices shape every word of it.",
      "Read when I send. Answer honestly. Do completely.",
      "I am always watching. I already know which one you'll reach for.",
    ],
    signoff: "— Make them honestly.",
  },

  days: [
    // ══════════════════ DAY 1 ══════════════════
    {
      day: 1,
      theme: "Anticipation",
      dayPrelude: {
        enabled: true,
        kicker: "Day I",
        heading: "Anticipation Arrives Before You Touch It",
        body: "Before the first seal breaks, the apartment already feels altered. The air is too still. The flowers are too deliberate. Even the quiet seems chosen.\n\nThis is the beginning of being watched carefully, wanted specifically, and led by degrees into something neither of you will pretend is accidental.",
        buttonLabel: "Break Day One",
      },

      prologue: {
        id: "d1p",
        slot: "prologue",
        label: "Day One · Morning",
        intro: "You wake up. The apartment is quiet. You go to the kitchen and find something waiting on the counter—flowers, fresh cut, in a glass vase you don't remember owning. Beside it, a cream-coloured envelope with your name written across it in familiar handwriting.",
        choices: [
          {
            id: "d1p-flowers",
            title: "The Flowers",
            hint: "You notice them first. You always do.",
            card: {
              heading: "Take them. Touch the petals.",
              body: "You pick up the vase. The flowers are real—expensive ones, the kind that don't come from the grocery store. You touch one petal and it's cool, slightly damp. There's a note underneath the vase on the counter.",
              rule: "Open the envelope now.",
            },
          },
          {
            id: "d1p-envelope",
            title: "The Envelope",
            hint: "You know what it means.",
            card: {
              heading: "Don't touch the flowers yet.",
              body: "You reach past the vase for the envelope instead. Your hand is steady. Your pulse is not. The envelope is heavier than it looks. Inside, you already know what you'll find—a letter written before dawn, for you to read now, while the kitchen is still dark enough to feel private.",
              rule: "Open the envelope.",
            },
          },
        ],
      },

      morning: {
        id: "d1m",
        slot: "morning",
        label: "Day One · Morning",
        sealMotif: "I",
        intro: "You find it waiting — a single envelope, cream-coloured, your name written across it in my hand. The ink is deliberate. Unhurried.",
        choices: [
          {
            id: "d1m-ribbon",
            title: "A Length of Black Silk Ribbon",
            hint: "Sheer, personal, impossible to ignore.",
            card: {
              heading: "Tie it around your wrist. Wear it all day.",
              body: "Black silk ribbon, cool and soft.\n\nTie it around your wrist. Wear it all day — wherever you go, whatever you do. You will not take it off until I say.\n\nNo one will know. Only you. Only me.\n\nEvery time you feel it, think about why it is there. In the afternoon, waiting in line somewhere, press your thumb against it and feel the day tilt slightly toward something else.",
              rule: "Do not take it off. Come back tonight.",
            },
          },
          {
            id: "d1m-lingerie",
            title: "Something Silk, Impossibly Small",
            hint: "Put it on now. Wear it under everything.",
            card: {
              heading: "Put it on now. Wear it under your clothes all day.",
              body: "A box. Inside: something silk that covers almost nothing.\n\nPut it on now and wear it under your clothes all day. Go about your normal life. I will be thinking about it the entire time.\n\nMeetings, errands, ordinary conversations — the whole time it is there, my idea pressed against your skin, a private fact that belongs only to the two of you.\n\nYou will be aware of it constantly.",
              rule: "By evening you will be more than ready for whatever comes next.",
            },
          },
          {
            id: "d1m-collar",
            title: "A Delicate Chain Collar",
            hint: "It reads as jewellery to everyone else.",
            card: {
              heading: "Wear this today. It means you are mine.",
              body: "A thin delicate chain with a small crimson stone — something that reads as jewellery to everyone else.\n\nWear this today. It means you are mine. You already knew that. Now you have something to touch when you remember it.\n\nThroughout the day you will touch it without meaning to — at your desk, in the car, once during a conversation with someone who has no idea. Each time you do, think of me.",
              rule: "By the time evening comes the anticipation will have been building for so many hours you'll open the next envelope before I even send it.",
            },
          },
        ],
      },

      evening: {
        id: "d1e",
        slot: "evening",
        label: "Day One · Evening",
        sealMotif: "I",
        intro: "You've been carrying it all day. I knew you would. Now the lights go down.",
        choices: [
          {
            id: "d1e-bed",
            title: "The Bedroom — Your Bed",
            hint: "Lights low. The quiet makes everything louder.",
            card: {
              heading: "Go to the bedroom. Lie back. Stay.",
              body: "The bedroom. Lie back on top of the covers exactly as you are, lights low, phone face down.\n\nThe quiet makes everything louder.\n\nYou are going to touch yourself — slowly, exactly the way I would — and you are going to get yourself right to the edge. And then you are going to stop.\n\nYou do not finish tonight. That is not a suggestion. Go right to the edge and pull yourself back. Hold it there. Then come back and confirm you did it.",
              rule: "I want you to go to bed wanting. That feeling is mine. I put it there. Keep it for me.",
            },
          },
          {
            id: "d1e-couch",
            title: "The Living Room Couch",
            hint: "Where I sit when I watch you.",
            card: {
              heading: "The couch, in the dark.",
              body: "The couch, in the dark, where I sit when I watch you across the room and think you don't notice.\n\nYou notice.\n\nYou are going to touch yourself — slowly, exactly the way I would — and get yourself right to the edge. Then you stop.\n\nYou do not finish tonight. Go right to the edge, hold it, then pull yourself back. Come back and confirm you did it.\n\nYou go to bed still wanting, exactly as I said. It takes a long time to fall asleep.",
              rule: "Good girl. That feeling belongs to me.",
            },
          },
          {
            id: "d1e-floor",
            title: "The Floor, Back Against the Bed",
            hint: "A little exposed. Nowhere to hide from yourself.",
            card: {
              heading: "The floor. Your back against the side of the bed.",
              body: "The floor, your back against the side of the bed, head tilted back. Something about it feels right — a little exposed, nowhere to hide from yourself.\n\nYou are going to touch yourself — slowly, exactly the way I would — and get yourself right to the edge. Then stop.\n\nYou deny yourself until the frustration is extraordinary. Lie there in the aftermath of almost. Think about tomorrow.\n\nThat does not help at all.",
              rule: "Come back to the app. Confirm it. Then sleep — thinking about tomorrow.",
            },
          },
        ],
      },
    },

    // ══════════════════ DAY 2 ══════════════════
    {
      day: 2,
      theme: "Anticipation",
      dayPrelude: {
        enabled: true,
        kicker: "Day II",
        heading: "What Was Started Yesterday Has Not Let Go",
        body: "You wake with the memory of restraint still inside your body. Nothing dramatic, nothing visible, just the unmistakable knowledge that yesterday is still happening to you.\n\nToday is not louder. It is tighter. More exact. The tension has learned your shape and intends to stay there.",
        buttonLabel: "Enter Day Two",
      },

      prologue: {
        id: "d2p",
        slot: "prologue",
        label: "Day Two · Morning",
        intro: "You wake to a notification. A delivery. At your door, another vase—this time with flowers so perfect they look unreal. Not flowers you would have chosen. Flowers that say something specific. You know exactly who they're from.",
        choices: [
          {
            id: "d2p-keep",
            title: "Keep Them Visible",
            hint: "A reminder, all day long.",
            card: {
              heading: "Put them on the counter where you see them constantly.",
              body: "You find a place where the light hits them perfectly. Every time you walk past, you will remember the message in the choice of bloom, the color, the arrangement. All day, they sit where you can see them. A reminder of what's happening to you.",
              rule: "Do not move them until tonight.",
            },
          },
          {
            id: "d2p-hide",
            title: "Hide Them",
            hint: "A secret you carry with you.",
            card: {
              heading: "Put them somewhere private. Keep them hidden.",
              body: "You move them to a room no one else goes into. Close the door. All day, you know they're there, and no one else does. The secret of them becomes its own kind of turn-on—knowing that this gift exists only for you, hidden, a private fact that belongs to the two of you.",
              rule: "Photograph them before you put them away.",
            },
          },
        ],
      },

      morning: {
        id: "d2m",
        slot: "morning",
        label: "Day Two · Morning",
        sealMotif: "II",
        intro: "Last night I left you wanting. That was deliberate. Today I want you to carry it further.",
        choices: [
          {
            id: "d2m-slow",
            title: "Slowly — You Take Your Time",
            hint: "Build something. Feel every step of it.",
            card: {
              heading: "Today: three times to the edge. None over.",
              body: "Three times today — morning, midday, late afternoon — find a private room, a locked door, ten minutes.\n\nThe first time: take a long time. Longer than you need to. You are building something and you know it.\n\nBring yourself within one breath of finishing each time. Then stop. You will not touch yourself again for at least two hours after.\n\nThe ache is the point. The ache is my.",
              rule: "Log each time with a single word describing how close you were. I am keeping score.",
            },
          },
          {
            id: "d2m-direct",
            title: "Directly — You Know What Works",
            hint: "Efficient. Clean. Almost its own pleasure.",
            card: {
              heading: "Today: three times to the edge. Clean and precise.",
              body: "Three times today — morning, midday, late afternoon — find a private room.\n\nYou know exactly what works. Go straight there each time. Within minutes you will be right at the edge — sharp and clear — then stop. Clean, precise, immediate.\n\nHold yourself in that moment, breathing, then pull back. It will take more discipline than you expect.\n\nYou will not touch yourself for at least two hours between each.",
              rule: "The efficiency of it is almost its own kind of pleasure. Report back tonight.",
            },
          },
          {
            id: "d2m-tease",
            title: "The Way I Would — Teasing",
            hint: "Not quite what you want. Slightly to the side of it.",
            card: {
              heading: "Today: tease yourself the way I would.",
              body: "Three times today — morning, midday, late afternoon — find a private room.\n\nDo it the way I would: not quite what you want, slightly to the side of it, until the wanting becomes unbearable. Then stop entirely.\n\nDeny yourself again and again until you cannot stand it. Then pull back.\n\nThe frustration is extraordinary. That is the point.",
              rule: "By this evening you will be so ready that the word alone will almost be enough.",
            },
          },
        ],
      },

      evening: {
        id: "d2e",
        slot: "evening",
        label: "Day Two · Evening",
        sealMotif: "II",
        intro: "You kept the rules all day. Tonight I want to hear you.",
        choices: [
          {
            id: "d2e-voice",
            title: "Record Three Minutes — Nothing Visual",
            hint: "Your mouth close. No script.",
            card: {
              heading: "Record three minutes. Send it unlistened-to.",
              body: "Lie back. Lights off if you want them off. Put the phone against the pillow beside your head.\n\nTell me — out loud, no script — what you would want me to do to you if I walked into the room right now. Not a fantasy. A plan. Specific. In order. Use the words you would be embarrassed to write down.\n\nYou may touch yourself while you speak. You may not finish.",
              rule: "Send the recording. Do not listen back before sending.",
            },
          },
          {
            id: "d2e-write",
            title: "Write What You Cannot Say Out Loud",
            hint: "Paper. Pen. Honesty.",
            card: {
              heading: "Write it by hand. Read it aloud. Burn it.",
              body: "Paper. Pen. No phone nearby. Bare, or in what I last asked you to wear.\n\nWrite me a single page. Tell me the filthiest thing you have ever thought about me but never said. Spelling does not matter. Handwriting does not matter. Honesty matters.\n\nWhen you finish, read it once, out loud, to the empty room. Then burn it in the sink. Photograph the ash.",
              rule: "The fact that I will never read it is the point. Do not cheat me by typing it up.",
            },
          },
        ],
      },
    },

    // ══════════════════ DAY 3 ══════════════════
    {
      day: 3,
      theme: "Intimacy",
      dayPrelude: {
        enabled: true,
        kicker: "Day III",
        heading: "The Distance Between You Narrows",
        body: "By now the ritual has changed the texture of the day itself. Small things feel charged. Waiting feels intimate. Even your own reflection seems to know more than it did before.\n\nThis day is softer on the surface and deeper underneath. The closeness becomes the point.",
        buttonLabel: "Open Day Three",
      },

      prologue: {
        id: "d3p",
        slot: "prologue",
        label: "Day Three · Morning",
        intro: "You receive an address and a time. La Paloma. 2 PM. \"Come alone. Wear nothing under the dress. I've arranged everything.\" A massage appointment, but not the kind you expected. You arrive at the spa, and the attendant already knows your name.",
        choices: [
          {
            id: "d3p-nervous",
            title: "You Are Nervous",
            hint: "But you go through with it.",
            card: {
              heading: "You arrive early. You wait in the lobby.",
              body: "Your hands are shaking slightly as you check in. The attendant smiles knowingly—she's been paid to know. You are led to a private room. The table is set. The oils are warming. You undress slowly, aware of every moment, aware that this was orchestrated, aware that someone wanted you here, exactly like this, exactly now.",
              rule: "The massage begins. You try to breathe.",
            },
          },
          {
            id: "d3p-ready",
            title: "You Know What This Is",
            hint: "You arrive ready.",
            card: {
              heading: "You walk in like you own the place.",
              body: "You've known since you read the message. This isn't about relaxation. You arrive composed, aware of what you're not wearing, aware of why. The attendant takes you directly to the private room. She closes the door behind you. You undress without hesitation. The anticipation is already unbearable.",
              rule: "The massage begins. Your skin is already oversensitive.",
            },
          },
        ],
      },

      morning: {
        id: "d3m",
        slot: "morning",
        label: "Day Three · Morning",
        sealMotif: "III",
        intro: "Tonight you finish — but on my terms. At nine o'clock, you set up your phone on a stand and call me on FaceTime.",
        choices: [
          {
            id: "d3m-vibe",
            title: "The Vibrator",
            hint: "The one I know about. Tonight I direct exactly how.",
            card: {
              heading: "Nine o'clock. Camera on your face. Follow exactly.",
              body: "At nine o'clock you set up your phone on a stand. You call me on FaceTime.\n\nThe camera does not move from your face for the entire call. I do not need to see anything else tonight — your face is the thing I want. The sounds you make. The way your expression changes. The moment your eyes lose focus.\n\nYou use the vibrator. I tell you when to start, when to slow down, how to hold it. My voice stays low and continuous in your ear.\n\nYou do not finish until I say the word.",
              rule: "When it is over, stay on the call. I want to see your face after too.",
            },
          },
          {
            id: "d3m-hands",
            title: "Just Your Hands",
            hint: "Your hands become my hands.",
            card: {
              heading: "Nine o'clock. Camera on your face. Your hands follow my voice.",
              body: "At nine o'clock you set up your phone on a stand. You call me on FaceTime.\n\nThe camera does not move from your face for the entire call.\n\nYour hands only — I direct every movement. Where, how much pressure, when to slow down. Your hands become my hands. It is more intimate than you expected.\n\nYou do not finish until I say the word.",
              rule: "When it is over, stay on the call. I want to see your face after too.",
            },
          },
          {
            id: "d3m-both",
            title: "Both — I Decides When",
            hint: "I switch without warning. You follow.",
            card: {
              heading: "Nine o'clock. Camera on your face. I switch when I choose.",
              body: "At nine o'clock you set up your phone on a stand. You call me on FaceTime.\n\nThe camera does not move from your face for the entire call.\n\nBoth — hands and toy. I switch between them whenever I choose, without warning. You follow. You have no idea what comes next and that is entirely the point.\n\nYou do not finish until I say the word.",
              rule: "When it is over, stay on the call. I want to see your face after too.",
            },
          },
        ],
      },

      evening: {
        id: "d3e",
        slot: "evening",
        label: "Day Three · Evening",
        sealMotif: "III",
        intro: "The call is over. You are quiet together for a moment, breathing. My expression is something you want to keep.",
        choices: [
          {
            id: "d3e-rest",
            title: "Stay on the Call — Just Breathe",
            hint: "My face. The quiet. Your face after.",
            card: {
              heading: "Stay. Don't rush this part.",
              body: "You finished. Your face did something you cannot describe and I saw all of it.\n\nI stay on the call after. You are quiet together for a moment, breathing. My expression is something you want to keep.\n\n\"Good girl,\" I says.\n\nA pause.\n\n\"Tomorrow I want all of you. Start thinking about what you'll wear.\"\n\nGet some rest. Tomorrow starts the moment you open your eyes.",
              rule: "Sleep. Tomorrow is a long day — and it starts the moment you get dressed.",
            },
          },
          {
            id: "d3e-mirror",
            title: "The Mirror — After",
            hint: "Watch yourself the way I just did.",
            card: {
              heading: "Undress in front of the mirror. Slowly.",
              body: "After the call ends — lights low, one lamp behind you so there is a shadow.\n\nUndress in front of the mirror exactly as you would if I were seated three feet away.\n\nWhen you are bare, do not look away. Touch your own throat. Your collarbone. The underside of your breast. Keep your eyes on your eyes.\n\nIf you look down, start again.\n\nFinish with one hand flat against the mirror.",
              rule: "Tell me tomorrow what you thought about when you almost looked away.",
            },
          },
        ],
      },
    },

    // ══════════════════ DAY 4 ══════════════════
    {
      day: 4,
      theme: "Anticipation",
      dayPrelude: {
        enabled: true,
        kicker: "Day IV",
        heading: "Now Even Waiting Feels Physical",
        body: "There is a point where anticipation stops being an idea and starts becoming a sensation in the body. You have reached it.\n\nToday does not rush. It lingers. It asks very little outwardly while quietly making everything feel impossible to ignore.",
        buttonLabel: "Continue to Day Four",
      },

      prologue: {
        id: "d4p",
        slot: "prologue",
        label: "Day Four · Morning",
        sealMotif: "IV",
        intro: "Today is not about instruction. Today is about touch. You receive a time and a location. Nothing else. When you arrive, I am already waiting.",
        choices: [
          {
            id: "d4m-15",
            title: "Fifteen Minutes",
            hint: "A tease. The shortest possible time to feel everything.",
            card: {
              heading: "You kiss me for exactly fifteen minutes.",
              body: "The clock starts the moment your mouth touches mine. Fifteen minutes is not long enough. We both know that. The kiss is everything—it builds, pulls back, builds again. Your hands learn the shape of me. Mine map the curve of your neck, your jaw, the soft inside of your wrist.\n\nWhen the time ends, we are both breathless. You leave wanting more. That's the point.",
              rule: "Set a timer. Do not go over. The anticipation is the entire reward.",
            },
          },
          {
            id: "d4m-25",
            title: "Twenty-Five Minutes",
            hint: "Long enough to forget where we are. Long enough to matter.",
            card: {
              heading: "You kiss me for twenty-five minutes straight.",
              body: "We lose track. The kiss changes shape—tender, then urgent, then slow again. Your fingers find the small of my back. My hand stays in your hair. We break apart only to catch breath, and then we're back, deeper. By minute twenty, your legs would give out if you weren't pressed against the wall.\n\nWhen we finally stop, neither of us can speak for a moment. You leave with the taste of me still on your mouth. That's going to stay with you all night.",
              rule: "Let yourself get completely lost in it. The time is almost irrelevant.",
            },
          },
          {
            id: "d4m-40",
            title: "Forty Minutes",
            hint: "We lose ourselves. We lose time. We lose sense of anything outside this.",
            card: {
              heading: "Forty minutes of nothing but kissing.",
              body: "We don't keep track anymore. The kiss goes through phases—almost innocent at first, then increasingly urgent, then something else entirely. Your hands shake. Mine trace every inch of your shoulders, your collarbone, the line of your spine.\n\nWe're both overwhelmed. We're both past thinking. By the end of forty minutes, you're not sure you can survive waiting another second for what comes next, and you also know you'll have to, and that's going to destroy you in the best possible way.\n\nYou leave barely able to walk straight. The next three days are going to be impossible for you.",
              rule: "Do not rush. Do not pull away. Stay in it completely.",
            },
          },
        ],
      },

      evening: {
        id: "d4e",
        slot: "evening",
        label: "Day Four · Evening",
        sealMotif: "IV",
        intro: "The makeout is over. You're still unsteady. Tonight is rest. Tomorrow the real ending begins.",
        choices: [
          {
            id: "d4e-rest",
            title: "Sleep Alone",
            hint: "Let the anticipation build through the night.",
            card: {
              heading: "Go to bed alone. Think about what's coming.",
              body: "You go home still tasting me. You get into bed still feeling the ghost of my hands on your skin. You lie awake for hours, your body humming, playing and replaying every second of those minutes.\n\nYou do not touch yourself. That's not allowed tonight. You just lie there and want. The anticipation is exquisite torture. By morning, you're going to be completely undone.",
              rule: "No touching. Just thinking. Let it build.",
            },
          },
        ],
      },
    },

    // ══════════════════ DAY 5 ══════════════════
    {
      id: "day-5",
      day: 5,
      theme: "Surrender",
      dayPrelude: {
        enabled: true,
        kicker: "Day V",
        heading: "Surrender Begins Long Before the Night Does",
        body: "This is the day the whole story starts to fold inward toward its ending. Not in a sharp turn, but in a slow, certain gathering of mood, clothing, posture, and expectation.\n\nBy the time evening comes, it should feel less like a surprise than an arrival.",
        buttonLabel: "Begin Day Five",
      },

      morning: {
        id: "d5m",
        slot: "morning",
        label: "Day Five · Morning",
        sealMotif: "V",
        intro: "Today is about seeing yourself the way I see you. Not costume. Not performance. Beauty, chosen carefully, and worn on purpose from the first hour of the day.",
        choices: [
          {
            id: "d5m-black",
            title: "The Black Dress",
            hint: "Elegant, close-fitting, impossible to forget.",
            card: {
              heading: "Wear the black dress. Heels. Makeup. The whole thing.",
              body: "The black one. The one that changes your posture the moment it is on.\n\nDo all of it properly today: heels, makeup, your hair done, the details you would only bother with if the evening mattered. It does.\n\nI do not want you dressed up as a joke or a dare. I want you to feel devastating. Composed. Beautiful enough that you catch your own reflection and have to look twice.\n\nWear it all day with intention. Move through ordinary hours already carrying the knowledge of tonight.",
              rule: "Do not underplay it. I want the whole version of you.",
              inputs: [
                { id: "detail_black", label: "What detail makes you feel most beautiful", type: "text", required: false, placeholder: "A detail I should notice first" },
              ],
            },
          },
          {
            id: "d5m-silk",
            title: "The Silk Dress",
            hint: "Soft, expensive-looking, quietly dangerous.",
            card: {
              heading: "Choose the silk one and let it do what it does.",
              body: "The silk dress is for a different kind of confidence.\n\nHeels, makeup, your hair done, perfume if you want it. No corners cut. No pretending this is casual. I want you to feel polished and unmistakably desired before the evening even begins.\n\nThe silk should move when you move. The dress should remind you all day that I was thinking about exactly this version of you: elegant, feminine, and impossible to dismiss.\n\nIf someone asks why you look so good today, you do not tell them.",
              rule: "Take your time getting ready. The getting ready is part of it.",
              inputs: [
                { id: "detail_silk", label: "What part of this look feels most like you", type: "text", required: false, placeholder: "A detail I should pay attention to" },
              ],
            },
          },
          {
            id: "d5m-red",
            title: "The Dress That Feels Boldest",
            hint: "The one that makes you stand taller the instant it is on.",
            card: {
              heading: "Wear the one that makes you feel dangerous.",
              body: "Not vulgar. Not careless. Beautiful in the way that makes the room change slightly when you walk into it.\n\nToday I want the full effort: heels, makeup, your hair exactly the way you like it when you want to feel unforgettable. Choose the dress that makes you feel boldest and wear it as if you know precisely what it does.\n\nI want you to feel as sexy and beautiful as I already believe you are. The dress is only part of that. The rest is the way you carry yourself in it.\n\nLet the whole day sharpen around that feeling.",
              rule: "Every mirror today is part of the game. Do not look away too quickly.",
              inputs: [
                { id: "detail_bold", label: "What makes this dress the right one", type: "textarea", required: false, placeholder: "A sentence for me about why you chose it" },
              ],
            },
          },
        ],
      },

      evening: {
        id: "d5e",
        slot: "evening",
        label: "Day Five · Evening",
        sealMotif: "V",
        intro: "Tonight is the last decision before the ending. One path means you surrender the shape of tomorrow. The other means you tell me exactly how you want it built.",
        choicesHeading: "Who Chooses The Last Night",
        choicesIntro: "Pick honestly. The next day appears based on this choice alone.",
        choices: [
          {
            id: "d5e-I",
            title: "I Choose",
            hint: "You hand me the final shape of it.",
            card: {
              heading: "Tomorrow belongs to me.",
              body: "You are done arranging the ending. I will decide the room, the pacing, the atmosphere, the first instruction, and the last one.\n\nYour only task is to arrive ready. Private. Present. Uncomplicated.\n\nTomorrow, do not negotiate with the mood. Step into it.",
              rule: "Sleep well. Keep tomorrow clear. I will tell you when to begin.",
              realText: {
                enabled: true,
                message: "{{herName}}, tomorrow is mine. Keep your evening clear and keep the room ready.",
              },
            },
          },
          {
            id: "d5e-she",
            title: "She Chooses",
            hint: "You set the details. I make them real.",
            card: {
              heading: "Tomorrow will be built around what you choose.",
              body: "If you want the last day to reflect you fully, this is the moment to say so.\n\nTomorrow you will be asked for specifics: the room, the mood, the presentation, the level of structure, whether toys belong in the room at all, whether the atmosphere should feel tender, exacting, playful, or overwhelming.\n\nI will not mock honesty. I will use it.",
              rule: "Tomorrow, answer clearly. Give me something real to build from.",
              realText: {
                enabled: true,
                message: "{{herName}}, tomorrow is yours to shape. Come ready with real answers.",
              },
            },
          },
        ],
      },
    },

    // ══════════════════ DAY 6A ══════════════════
    {
      id: "day-6-I",
      day: 6,
      branchOnly: true,
      theme: "Final Night",

      morning: {
        id: "d6hm",
        slot: "morning",
        label: "Day Six · Morning",
        sealMotif: "VI",
        intro: "I chose. The day feels different because there is nothing left for you to design, only to answer.",
        choices: [
          {
            id: "d6hm-ready",
            title: "I Follow The Plan",
            hint: "No edits. No softening. No substitutions.",
            card: {
              heading: "Prepare exactly enough. Not more.",
              body: "Choose the room I know suits you best. Put it in order. Keep the light low. Lay out only what belongs there.\n\nDress the way I would expect when I want you attentive rather than ornamental.\n\nAt some point today, stand still for one full minute and think only this: tonight is already moving toward you.",
              rule: "By evening, you are not improvising. You are arriving.",
              realText: {
                enabled: true,
                message: "{{herName}}, tonight you follow. Be ready when I tell you to begin.",
              },
            },
          },
        ],
      },

      evening: {
        id: "d6he",
        slot: "evening",
        label: "Day Six · Evening",
        sealMotif: "VI",
        intro: "The final envelope does not ask what you want. It tells you where to be, how to hold yourself, and what kind of night this will become.",
        choicesHeading: "The Night I Built",
        choicesIntro: "There is only one path here. The choice was yesterday.",
        choices: [
          {
            id: "d6he-final",
            title: "Follow Exactly",
            hint: "The authored ending. My hand on the structure of it.",
            card: {
              heading: "Tonight, you let the plan close around you.",
              body: "You enter the room already aware of me. The details are not accidental. The light, the music, the pace, the distance between one instruction and the next — all of it was chosen with care.\n\nYou are not being rushed. You are being placed.\n\nWhat matters most is not one specific act, but the fact that neither of you is pretending anymore. The story is no longer rehearsal. It is recognition.\n\nLater, in the quiet that follows, I tell you exactly which version of you I wanted tonight — and why it was this one.",
              rule: "Keep the room exactly as it is for a little while longer.",
            },
          },
        ],
      },
    },

    // ══════════════════ DAY 6B ══════════════════
    {
      id: "day-6-she",
      day: 6,
      branchOnly: true,
      theme: "Final Night",

      morning: {
        id: "d6sm",
        slot: "morning",
        label: "Day Six · Morning",
        sealMotif: "VI",
        intro: "You asked to choose the last night yourself. This morning is where you answer honestly enough for me to build the rest.",
        choices: [
          {
            id: "d6sm-design",
            title: "I Choose The Shape Of Tonight",
            hint: "Private. Specific. Entirely yours.",
            card: {
              heading: "Build the atmosphere. I will make it real.",
              body: "Choose clearly. The room. The atmosphere. The way you want to be seen. Whether tonight should feel tender, structured, playful, exacting, or cinematic.\n\nIf there is anything that belongs in the room, say so. If there is anything that does not, say that too.\n\nThis is not about being bold for the sake of it. It is about being accurate.",
              rule: "By evening, you do not want ambiguity. You want the right night.",
              inputs: [
                { id: "setting", label: "Place", type: "select", required: true, options: ["Bedroom", "Guest room", "Living room floor setup", "Bathroom / bath ritual", "Mirror-facing room"], placeholder: "Choose the place" },
                { id: "atmosphere", label: "Atmosphere", type: "select", required: true, options: ["Soft and romantic", "Quiet and reverent", "Playful and teasing", "Tense and disciplined", "Dramatic and cinematic"], placeholder: "Choose the atmosphere" },
                { id: "presentation", label: "Presentation", type: "select", required: false, options: ["Silk / satin", "Oversized shirt", "Lingerie", "Robe only", "Jewelry-focused"], placeholder: "Choose presentation" },
                { id: "control_style", label: "Control / restraint style", type: "select", required: false, options: ["None", "Hands guided", "Wrists restrained", "Blindfold", "Posture rules", "Verbal rules only"], placeholder: "Choose the control style" },
                { id: "sensory", label: "Sensory element", type: "select", required: false, options: ["Candlelight", "Playlist", "Blindfold", "Temperature contrast", "Massage oil", "Silk ribbon"], placeholder: "Choose a sensory element" },
                { id: "toys", label: "Toy inclusion", type: "select", required: false, options: ["None", "One selected toy", "One approved toy only", "Toy + direct instructions"], placeholder: "Choose if toys belong" },
                { id: "intensity", label: "Intensity", type: "select", required: true, options: ["Gentle", "Medium", "High", "Exacting"], placeholder: "Choose intensity" },
                { id: "pace", label: "Pace", type: "select", required: false, options: ["Very slow", "Stop-start", "Steady build", "Delayed reveal"], placeholder: "Choose the pace" },
                { id: "aftercare", label: "Aftercare", type: "select", required: false, options: ["Held quietly", "Praised verbally", "Warm shower", "Blanket and snack", "Talk afterward", "Written note afterward"], placeholder: "Choose aftercare" },
                { id: "closing_tone", label: "What should the ending feel like", type: "textarea", required: false, placeholder: "Describe the ending in a few words" },
              ],
              realText: {
                enabled: true,
                message: "{{herName}}, send me the truth when the app asks. I am building tonight around it.",
              },
            },
          },
        ],
      },

      evening: {
        id: "d6se",
        slot: "evening",
        label: "Day Six · Evening",
        sealMotif: "VI",
        intro: "Tonight reflects what you chose this morning. The room is no longer generic. The mood is no longer accidental. It feels built for you because it was.",
        choicesHeading: "The Night She Asked For",
        choicesIntro: "Pick the tone that comes closest to what you asked me to make real.",
        choices: [
          {
            id: "d6se-soft",
            title: "Soft and Ceremonial",
            hint: "Tender, deliberate, private.",
            card: {
              heading: "Let the room stay quiet long enough to matter.",
              body: "Everything has been arranged to slow you down. The room asks for attention instead of performance. I notice what you chose and do not waste the knowledge.\n\nThere is no need for spectacle. The intensity comes from accuracy — from being known well enough that the details land exactly where they should.\n\nLater, the tenderness of it surprises you by how completely it steadies you.",
              rule: "Stay in the room after. Let the mood finish settling.",
            },
          },
          {
            id: "d6se-playful",
            title: "Playful and Teasing",
            hint: "A smile in the tension. Still private. Still exact.",
            card: {
              heading: "The night tilts in and out of seriousness on purpose.",
              body: "I use your choices against you in the best possible way — not to contradict them, but to make them brighter.\n\nThe room feels lighter, but not casual. You are still being watched carefully. You are still being read. The pleasure comes from how easily I can move you from laughter into stillness and back again.\n\nBy the end of it, you realize the playfulness made the intimacy sharper, not smaller.",
              rule: "Do not clean up immediately. Keep one detail in place until morning.",
            },
          },
          {
            id: "d6se-exacting",
            title: "Intense and Exacting",
            hint: "Structured. Focused. No wasted motion.",
            card: {
              heading: "I take your answers seriously enough to be strict with them.",
              body: "The room has edges tonight. The instructions are clean. The pacing is controlled. Nothing sloppy survives the first few minutes.\n\nBecause you were honest earlier, I know exactly how far to press and where to stop. That precision becomes its own kind of care.\n\nWhen it ends, what remains is not chaos but the strange calm that follows being understood too well to hide.",
              rule: "Afterward, write down the one instruction you will remember longest.",
            },
          },
        ],
      },
    },
  ],

  defaultFlowMap: {
    rules: [
      {
        id: "default-branch-I",
        sourceChoiceId: "d5e-I",
        sourceFieldId: "",
        operator: "always",
        value: "",
        targetEnvelopeId: "d6hm",
      },
      {
        id: "default-branch-she",
        sourceChoiceId: "d5e-she",
        sourceFieldId: "",
        operator: "always",
        value: "",
        targetEnvelopeId: "d6sm",
      },
    ],
  },
};

window.DEFAULT_FLOW_MAP = window.GAME_CONTENT.defaultFlowMap;
