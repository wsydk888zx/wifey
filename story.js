// ── STORY DATA ────────────────────────────────────────────────────────────────
// Pure narrative content. No imports from app. All name interpolation via ctx.
// ctx = { her, his, Her, His, d1, d2, d3, d4 }
//   her/his = lowercase names
//   Her/His = capitalised names
//   d1–d4   = choices objects for previous days

export const CHAPTERS = [

  // ══════════════════════════════ DAY 1 ════════════════════════════════════
  // Pure anticipation. Nothing physical. She carries a secret all day.
  {
    id: 0,
    number: 'Day One',
    title: 'The Letter',
    subtitle: 'Every story begins with a word.',

    intro: (ctx) => `
      <p>You find it waiting — a single envelope, cream-coloured, your name written across it in his hand. The ink is deliberate. Unhurried. As if he had all the time in the world and chose to spend a little of it on just your name.</p>
      <p>You open it.</p>
      <div class="letter">
        <p><em>${ctx.Her},</em></p>
        <p><em>I have been thinking about you. This is not unusual. But lately my thoughts have taken a very specific shape — a game, a story, five days that belong entirely to us.</em></p>
        <p><em>Each day I will ask one thing of you. Each day it will be a little more than the day before. By the end you will know exactly how well I know you — and exactly how far you will go for me.</em></p>
        <p><em>Today I ask only this: go to the bedroom. I have left something on the bed. Put it on immediately. You will wear it for the rest of the day — wherever you go, whatever you do. You will not take it off until I say.</em></p>
        <p><em>No one will know. Only you. Only me.</em></p>
        <p><em>That is today's game. Carry it.</em></p>
        <p><em>— ${ctx.His}</em></p>
      </div>
      <p>You put the letter down. Something has already shifted — a small interior rearrangement, a door opening somewhere you weren't expecting. You go to the bedroom.</p>
      <p>On the bed, three options. He has let you choose — which means he already knows which one you'll reach for.</p>
    `,

    choices: {
      first: {
        label: 'What does he leave for you?',
        options: [
          { key: 'ribbon',   desc: 'A length of black silk ribbon',   text: 'Black silk ribbon, cool and soft. A note reads: <em>tie it around your wrist. Wear it all day. Every time you feel it, think about why it is there.</em>' },
          { key: 'lingerie', desc: 'Something silk, impossibly small', text: 'A box. Inside: something silk that covers almost nothing, with a note: <em>put this on now and wear it under your clothes all day. Go about your normal life. I will be thinking about it the entire time.</em>' },
          { key: 'collar',   desc: 'A delicate chain collar',          text: 'A thin delicate chain with a small crimson stone — something that reads as jewellery to everyone else. The note: <em>wear this today. It means you are mine. You already knew that. Now you have something to touch when you remember it.</em>' }
        ]
      }
    },

    outro: (c) => {
      const m = {
        ribbon:   `<p>You tie the ribbon loosely around your wrist. It is only silk. But it sits there all day like a whispered word — present, impossible to ignore, meaningful only to you. You catch yourself touching it at odd moments. In the afternoon, waiting in line somewhere, you press your thumb against it and feel the day tilt slightly toward something else.</p><p>That night you sleep with it still on. You dream without remembering what about, but you wake up already thinking about tomorrow's envelope.</p>`,
        lingerie: `<p>You put it on. It is exactly as small as you expected. You go about your entire day wearing it underneath everything — meetings, errands, ordinary conversations — and the whole time it is there, his idea pressed against your skin, a private fact that belongs to the two of you. You are aware of it constantly. By evening you are more than ready for whatever comes next.</p>`,
        collar:   `<p>You put it on. In the mirror it looks like jewellery, which it is, which it isn't. Throughout the day you touch it without meaning to — at your desk, in the car, once during a conversation with someone who has no idea. Each time you do, you think of him. By the time evening comes the anticipation has been building for so many hours that you open the app before he has even sent the next chapter.</p>`
      };
      return m[c.first] || m.ribbon;
    },

    closing: (ctx) => `<p>Don't take it off yet, ${ctx.her}. Come back tomorrow.</p>`
  },

  // ══════════════════════════════ DAY 2 ════════════════════════════════════
  // Rules established. She touches herself. She does NOT finish.
  {
    id: 1,
    number: 'Day Two',
    title: 'The Edge',
    subtitle: 'The most important word tonight is: stop.',

    intro: (ctx) => {
      const callback = ctx.d1.first === 'ribbon'
        ? `<p>The ribbon is still on your wrist. You find the envelope with both hands, silk catching the light.</p>`
        : ctx.d1.first === 'lingerie'
        ? `<p>You wore it all day. He knew you would. You find today's envelope already thinking about what comes next.</p>`
        : `<p>You have been touching the chain without realising it all day. You find today's envelope with one hand still at your throat.</p>`;
      return `
        ${callback}
        <p>Today's card is longer. He has been thinking carefully.</p>
        <div class="letter">
          <p><em>Some rules before we go further.</em></p>
          <p><em>One: you read when I send. Not before.</em></p>
          <p><em>Two: when I ask you something, you answer honestly. I will always know the difference.</em></p>
          <p><em>Three: whatever I ask you to do, you do it completely. Half measures don't count.</em></p>
          <p><em>Four: tonight's task is this.</em></p>
          <p><em>You are going to touch yourself — slowly, exactly the way I would — and you are going to get yourself right to the edge. And then you are going to stop.</em></p>
          <p><em>You do not finish tonight. That is not a suggestion.</em></p>
          <p><em>Go somewhere private. Take your time getting there. When you are right at the edge — and you will know — you stop. You come back here and you confirm you did it.</em></p>
          <p><em>I want you to go to bed wanting. That feeling is mine. I put it there. Keep it for me.</em></p>
          <p><em>— ${ctx.His}</em></p>
        </div>
        <p>You read it twice. The third time you only read the part that says <em>you do not finish tonight.</em></p>
        <p>You already feel it — a slow pull of anticipation low in your stomach. You close the app.</p>
        <p>You go find somewhere private.</p>
      `;
    },

    choices: {
      where: {
        label: 'Where do you go?',
        options: [
          { key: 'bed',   desc: 'The bedroom — your bed',          text: 'The bedroom. You lie back on top of the covers exactly as you are, lights low, phone face down. The quiet makes everything louder.' },
          { key: 'couch', desc: 'The living room couch',            text: 'The couch, in the dark, where he sits when he watches you across the room and thinks you don\'t notice. You notice.' },
          { key: 'floor', desc: 'The floor, back against the bed',  text: 'The floor, your back against the side of the bed, head tilted back. Something about it feels right — a little exposed, nowhere to hide from yourself.' }
        ]
      },
      how: {
        label: 'How do you get there?',
        options: [
          { key: 'slow',   desc: 'Slowly — you take your time',           text: 'You take a long time. Longer than you need to. You are building something and you know it, and you want to feel every step of it.' },
          { key: 'direct', desc: 'Directly — you already know what works', text: 'You know exactly what works. You go straight there. The efficiency of it is almost its own kind of pleasure.' },
          { key: 'tease',  desc: 'You tease yourself the way he would',    text: 'You do it the way he would — which is to say, not quite what you want, slightly to the side of it, until the wanting becomes unbearable.' }
        ]
      }
    },

    outro: (c) => {
      const whereText = {
        bed:   `<p>You lie on the bed in the dark.`,
        couch: `<p>You sit on the couch in the quiet.`,
        floor: `<p>You sit on the floor with your back against the bed.`
      };
      const howText = {
        slow:   `You take your time. Every minute of it feels deliberate, weighted, significant. You keep going until the edge is right there — unmistakable, close enough to feel the current of it — and then you stop. Your hands still. Your breath goes shallow. You hold it there for a second, then two, then pull yourself back.</p>`,
        direct: `You don't waste time. Within minutes you are right there — the edge of it sharp and clear — and you stop. Clean, precise, immediate. You hold yourself in that moment, breathing, and then you pull back. It takes more discipline than you expected.</p>`,
        tease:  `You deny yourself, again and again, until you cannot stand it — and then you stop entirely. The frustration of it is extraordinary. You lie there in the aftermath of almost, and you think about tomorrow, and that does not help at all.</p>`
      };
      return `${whereText[c.where] || whereText.bed} ${howText[c.how] || howText.slow}
        <p>You come back to the app. You confirm it. You did what he asked.</p>
        <p>You go to bed still wanting, exactly the way he said. It takes a long time to fall asleep. When you do, it is with one thought cycling: <em>tomorrow.</em></p>`;
    },

    closing: (ctx) => `<p>Good girl. That feeling belongs to me. I'm keeping it until tomorrow. — ${ctx.His}</p>`
  },

  // ══════════════════════════════ DAY 3 ════════════════════════════════════
  // FaceTime. Camera on her face ONLY. He directs. She finishes when he says.
  {
    id: 2,
    number: 'Day Three',
    title: 'Your Face',
    subtitle: 'Tonight he watches. Just your face. Nothing else.',

    intro: (ctx) => {
      const d2callback = ctx.d2.where === 'bed'
        ? `<div class="callback-note"><strong>He knows.</strong> <em>"You went to the bedroom. I thought you would. I thought about you there all night."</em></div>`
        : ctx.d2.where === 'couch'
        ? `<div class="callback-note"><strong>He knows.</strong> <em>"The couch. I pictured exactly that. I have not stopped thinking about it."</em></div>`
        : `<div class="callback-note"><strong>He knows.</strong> <em>"The floor. That surprises me, which means you are still capable of surprising me, which I find extremely attractive."</em></div>`;
      return `
        ${d2callback}
        <div class="letter">
          <p><em>${ctx.Her},</em></p>
          <p><em>Last night I left you wanting. That was deliberate. Tonight you finish — but on my terms.</em></p>
          <p><em>Here is how tonight works.</em></p>
          <p><em>At nine o'clock you set up your phone on a stand. You call me on FaceTime. The camera does not move from your face for the entire call. I do not need to see anything else tonight — your face is the thing I want. The sounds you make. The way your expression changes. The moment your eyes lose focus.</em></p>
          <p><em>I will tell you what to do and when. You follow exactly. You do not finish until I say the word.</em></p>
          <p><em>When it is over, you will stay on the call. I want to see your face after too.</em></p>
          <p><em>Nine o'clock, ${ctx.her}. Do not be late.</em></p>
          <p><em>— ${ctx.His}</em></p>
        </div>
        <p>Nine o'clock. The phone is on its stand. The room is dark except for the light from the screen.</p>
        <p>His face appears. He looks at you for a moment without saying anything. Then:</p>
        <p><em>"Good. Now — what are you using tonight?"</em></p>
      `;
    },

    choices: {
      toy: {
        label: 'What do you use?',
        options: [
          { key: 'vibe',  desc: 'The vibrator',         text: 'The vibrator — the one he knows about, the one he has seen before in a different context. Tonight he directs exactly how you use it, and you do exactly that.' },
          { key: 'hands', desc: 'Just your hands',       text: 'Your hands only. He directs every movement — where, how much pressure, when to slow down. Your hands become his hands. It is more intimate than you expected.' },
          { key: 'both',  desc: 'Both — he decides when', text: 'Both. He switches between them whenever he chooses, without warning. You follow. You have no idea what comes next and that is entirely the point.' }
        ]
      }
    },

    outro: (c) => {
      const toyLine = {
        vibe:  `You pick up the vibrator. His voice stays low and continuous in your ear — start slow, he says, slower than you want to. You do.`,
        hands: `Your hands. His voice guides them — here, he says, like this, slower. Your hands become something borrowed, directed by someone else, which makes them feel entirely different.`,
        both:  `He switches between the two without pattern. You never know which he'll choose next. The unpredictability keeps you constantly on edge.`
      };
      return `
        <p>${toyLine[c.toy] || toyLine.vibe}</p>
        <p>The camera stays on your face throughout. That is the rule, and you keep it.</p>
        <p>He watches every expression. He keeps you just below the edge for a long time — longer than last night, long enough that when he finally says <em>"now"</em> the word itself is almost enough to finish you. Almost.</p>
        <p>You finish. Your face does something you cannot describe and he sees all of it.</p>
        <p>He stays on the call after. You are quiet together for a moment, breathing. His expression is something you want to keep.</p>
        <p><em>"Good girl,"</em> he says.</p>
        <p>A pause.</p>
        <p><em>"Tomorrow I want all of you. Start thinking about what you'll wear."</em></p>
      `;
    },

    closing: (ctx) => `<p>Get some rest, ${ctx.her}. Tomorrow is a long day — and it starts the moment you get dressed.</p>`
  },

  // ══════════════════════════════ DAY 4 ════════════════════════════════════
  // Dressed all day. Remote vibrator. FaceTime — everything shown.
  {
    id: 3,
    number: 'Day Four',
    title: 'The Long Day',
    subtitle: 'Today starts the moment you open your eyes.',

    intro: (ctx) => {
      const d3callback = ctx.d3.toy === 'vibe'
        ? `<div class="callback-note"><strong>He has been thinking about your face.</strong> <em>"I watched that call back. The moment my voice said now — I have not stopped thinking about your face in that moment. Tonight I want the rest of you."</em></div>`
        : ctx.d3.toy === 'hands'
        ? `<div class="callback-note"><strong>He has been thinking about your hands.</strong> <em>"Your hands doing what I said. Following exactly. Tonight I want to watch all of you follow exactly."</em></div>`
        : `<div class="callback-note"><strong>He has been thinking about the call.</strong> <em>"The way you followed every instruction without hesitation. Tonight: no restrictions on the camera. I want everything."</em></div>`;
      return `
        ${d3callback}
        <div class="letter">
          <p><em>${ctx.Her},</em></p>
          <p><em>Today belongs to me from the moment you read this.</em></p>
          <p><em>Here is how today works.</em></p>
          <p><em>You are going to get dressed as if tonight is the most important evening of your life. Full makeup — take your time with it. Your hair done. Something that makes you feel the way I want you to feel tonight: beautiful, aware of yourself, like someone being watched even when no one is watching.</em></p>
          <p><em>You will wear heels. Not for dinner. Not for the evening. All day. From the moment you finish getting ready until I tell you otherwise.</em></p>
          <p><em>You go about your normal day looking exactly like this. If anyone asks, you have plans tonight. You do.</em></p>
          <p><em>At the time you choose below, you will insert the remote vibrator and leave it in. I have the remote. You will not know when it turns on. You will behave normally when it does.</em></p>
          <p><em>At nine o'clock tonight you call me on FaceTime. This time there are no restrictions on the camera. I want to see everything. You will show me everything. This is not a request.</em></p>
          <p><em>Today is mine. You are mine. Dress accordingly.</em></p>
          <p><em>— ${ctx.His}</em></p>
        </div>
        <p>You read it twice. Then you go to your wardrobe.</p>
      `;
    },

    choices: {
      outfit: {
        label: 'What do you wear?',
        options: [
          { key: 'dress',   desc: 'The dress he loves most',            text: 'The specific one. The one that does what it does. You have worn it before and watched his face change. You wear it today knowing he is already thinking about it.' },
          { key: 'saved',   desc: 'Something you\'ve been saving',      text: 'Something that has been waiting for the right occasion. This is the right occasion. You put it on and it feels like a decision.' },
          { key: 'classic', desc: 'Classic — effortlessly put together', text: 'Simple, clean, composed. Nothing that announces itself. You look the way you look when you know exactly what you are doing, which is the most dangerous version of you.' }
        ]
      },
      vibe_timing: {
        label: 'When does the vibrator go in?',
        options: [
          { key: 'morning',   desc: 'Before you leave the house',     text: 'You insert it before you go anywhere. You spend the entire day knowing it is there, waiting, his to activate whenever he chooses.' },
          { key: 'afternoon', desc: 'Mid-afternoon',                   text: 'Mid-afternoon — you find a private moment and put it in. The rest of the day you carry it. The anticipation of the evening intensifies with every hour.' },
          { key: 'before',    desc: 'Just before the FaceTime call',   text: 'Just before nine — you insert it right before the call, already dressed, already made up, heels still on. He turns it on for the first time when you are already on camera.' }
        ]
      }
    },

    outro: (c) => {
      const outfitLine = {
        dress:   `You wear the dress. You catch your reflection mid-morning and think: he is going to lose his mind.`,
        saved:   `You wear the thing you were saving. Today turns out to be exactly what you were saving it for.`,
        classic: `You are polished, composed, effortless. You go through the day knowing what is underneath the composure, which makes the composure a kind of private joke between you and yourself.`
      };
      const vibeLine = {
        morning:   `The vibrator goes in before you leave the house. You spend the day with the quiet knowledge of it — and then, without warning, at some point in the afternoon, it turns on. You are in the middle of something ordinary. You continue. Your face gives nothing away, or almost nothing.`,
        afternoon: `Mid-afternoon you find a private moment. From then until evening it is there — occasionally turning on without warning, never for too long, enough to keep you continuously aware and continuously wanting.`,
        before:    `You insert it at eight fifty-five, already dressed, hair done, heels on, waiting. When the call connects and his face appears on the screen, the first thing he does is turn it on. You are already on camera when you feel it start.`
      };
      return `
        <p>${outfitLine[c.outfit] || outfitLine.dress}</p>
        <p>You spend the day in heels as instructed. All day. There is something about the deliberateness of it — the fact that you are dressed like this for no visible reason, carrying the knowledge of why — that keeps the anticipation from ever fully settling.</p>
        <p>${vibeLine[c.vibe_timing] || vibeLine.morning}</p>
        <p>Nine o'clock. You call him.</p>
        <p>When his face appears he takes a long moment to look at you. You are fully made up, beautifully dressed, heels on, camera angle set so he can see everything he asked to see.</p>
        <p><em>"Show me,"</em> he says.</p>
        <p>You do. All of it. Everything he asked for, everything he has been waiting to see, the camera showing him exactly what he told you to show him. He talks you through every moment of it in a low, certain voice. He controls the vibrator. You follow every instruction without hesitation.</p>
        <p>By the time it is over you are completely undone — mascara and composure alike. He watches it happen and does not look away for a single second.</p>
        <p>After, still on camera, breathing slowly back to normal, he says just two words.</p>
        <p><em>"Tomorrow. Us."</em></p>
      `;
    },

    closing: (ctx) => `<p>Sleep, ${ctx.her}. Tomorrow is the last chapter. It happens in person.</p>`
  },

  // ══════════════════════════════ DAY 5 ════════════════════════════════════
  // The real scene. Every detail chosen.
  {
    id: 4,
    number: 'Day Five',
    title: 'The Night He Planned',
    subtitle: 'Every detail. Every choice. His.',
    isLast: true,

    intro: (ctx) => {
      const outfitRef = ctx.d4.outfit === 'dress'
        ? `<p>He is thinking about the dress. <em>"I saw you in it on that call,"</em> he says. <em>"I have not stopped thinking about that image for one second."</em></p>`
        : ctx.d4.outfit === 'saved'
        ? `<p>He is thinking about the thing you wore — the one you had been saving. <em>"That was worth the wait,"</em> he says. <em>"Tonight is worth the wait too."</em></p>`
        : `<p>He is thinking about how composed you looked while carrying all of that underneath. <em>"Tonight,"</em> he says, <em>"there is no composure. Just us."</em></p>`;
      const vibeRef = ctx.d4.vibe_timing === 'morning'
        ? `<p>He says: <em>"You wore that all day. I could see it on your face during the call — what a whole day of waiting does to you. Tonight there is no waiting."</em></p>`
        : ctx.d4.vibe_timing === 'before'
        ? `<p>He says: <em>"I turned it on the second you connected. The look on your face — that is what tonight starts from."</em></p>`
        : `<p>He says: <em>"Last night was mine to watch. Tonight is mine to touch."</em></p>`;
      return `
        <p>No envelope this morning. Instead, he is already awake, watching you with the expression you have catalogued over the years but never gotten used to — the one that means you are what he came back for, every single time.</p>
        ${outfitRef}
        ${vibeRef}
        <p><em>"Tonight I have planned everything,"</em> he says. <em>"But I want you to choose the details. Because the details matter, and I want this to be exactly what you need it to be."</em></p>
        <p>He sets a card in your hands. It is longer than the others.</p>
        <div class="letter">
          <p><em>You have made it to the last night of our story, ${ctx.her}. Tonight has no limits. Answer every question. I will build the evening around your answers — and then I will take you apart inside it.</em></p>
          <p><em>— ${ctx.His}</em></p>
        </div>
        <p>You read the questions. You answer them the only way you know how: honestly.</p>
      `;
    },

    choices: {
      decider: {
        label: 'Who plans tonight?',
        options: [
          { key: 'her', desc: 'I choose every detail',   text: 'I want to build this myself — every detail chosen, every preference stated. Tonight is mine to design.' },
          { key: 'him', desc: 'He decides — surprise me', text: 'I want him to plan everything. I will not know the details until he sends them to me. I trust him completely.' }
        ]
      },
      location: {
        label: 'Where in the house does this happen?',
        options: [
          { key: 'bedroom',    desc: 'The bedroom',    text: 'The bedroom — your bed, the place that already holds your whole history together, made new again tonight.' },
          { key: 'kitchen',    desc: 'The kitchen',    text: 'The kitchen — against the counter or laid across the table, the ordinary made completely extraordinary.' },
          { key: 'livingroom', desc: 'The living room', text: 'The living room — the couch, the rug, the open space and soft light of it.' },
          { key: 'shower',     desc: 'The shower',     text: 'The shower — steam and heat, skin against wet skin, nowhere to go, nothing between you.' }
        ]
      },
      dinner: {
        label: 'The evening begins with…',
        options: [
          { key: 'he_cooks',     desc: 'He cooks for you',     text: 'He cooks for you — something real, with candles and wine, the particular intimacy of being fed by someone who loves you.' },
          { key: 'cook_together', desc: 'You cook together',   text: 'You cook together — his hands finding you between tasks, making everything take twice as long. You don\'t mind at all.' },
          { key: 'order_in',     desc: 'Order in, eat in bed', text: 'You order in and eat in bed together, unhurried, the food almost beside the point, his leg pressed against yours the entire time.' },
          { key: 'skip',         desc: 'Skip dinner entirely', text: 'No dinner. You are already past wanting food. He agrees completely.' }
        ]
      },
      warmup: {
        label: 'Before anything else…',
        options: [
          { key: 'massage', desc: 'A full body massage',    text: 'He gives you a full body massage — warm oil, slow certain hands, no agenda for the first thirty minutes. You are completely undone before anything has even begun.' },
          { key: 'dance',   desc: 'Dancing together first', text: 'He puts something low and slow on and pulls you against him. No agenda. You dance in the living room for twenty minutes, his mouth at your temple, his hand in the small of your back. By the time you move to the bedroom you are already soft and ready.' },
          { key: 'kneel',   desc: 'You kneel for him first', text: 'You kneel for him first. Your mouth, your hands, the full submission of it — before anything else is decided. He lets you, watching with an expression that makes everything worth it.' },
          { key: 'tied',    desc: 'He binds you first',     text: 'He ties your wrists before anything else. You spend the first half hour bound and waiting in the dark, listening to him move around the room, building anticipation that borders on unbearable.' }
        ]
      },
      oral: {
        label: 'Oral —',
        options: [
          { key: 'receive', desc: 'He goes down on you first',  text: 'He goes down on you first — thoroughly, unhurriedly, until you have finished at least once before anything else begins. He does not come up until you pull him up yourself.' },
          { key: 'give',    desc: 'You take him in your mouth', text: 'You take him in your mouth — all of him, until he has to pull you back by the hair before he loses control entirely.' },
          { key: 'both',    desc: 'Both, completely',           text: 'Both — he goes down on you first, then you return it in full, and then neither of you can wait a single moment longer.' },
          { key: 'none',    desc: 'Straight to it',             text: 'No oral. You are both already so ready that skipping it feels like the only sane option.' }
        ]
      },
      position: {
        label: 'How he takes you:',
        options: [
          { key: 'missionary', desc: 'Face to face',      text: 'On your back, face to face — he wants to watch every expression you make and he does not look away once.' },
          { key: 'doggy',      desc: 'From behind',       text: 'On all fours, taken from behind — his hands in your hair or at your hips, his mouth at your shoulder.' },
          { key: 'riding',     desc: 'You on top',        text: 'You on top — you control the pace, he controls everything else, his hands never leaving your body.' },
          { key: 'wall',       desc: 'Against the wall',  text: 'Pressed against the wall — lifted, held, legs wrapped around him, nowhere to go and no desire to be anywhere else.' }
        ]
      },
      finish: {
        label: 'Where does he finish?',
        options: [
          { key: 'inside',     desc: 'Inside you — deep',           text: 'Inside you — deep and completely, the warmth and the weight of it, the intimacy of nothing between you.' },
          { key: 'mouth',      desc: 'In your mouth — you swallow',  text: 'In your mouth — all of it. You look up at him as you take it. You swallow every drop, slowly, while he watches.' },
          { key: 'face',       desc: 'On your face',                 text: 'On your face — you look up at him, eyes open, and you let him. Every drop. He brushes your cheek afterward with his thumb, possessive and tender at once.' },
          { key: 'ass',        desc: 'In your ass',                  text: 'In your ass — slow first, opening you carefully, then however he wants. All of it inside you. You feel it for hours afterward.' },
          { key: 'chest',      desc: 'On your chest',                text: 'On your chest and breasts — he watches it land, then runs his fingers through it slowly, spreading it across your skin like something deliberate.' },
          { key: 'his_choice', desc: 'His choice, in the moment',    text: 'His choice entirely. He does not tell you where until the last possible moment. The not knowing is part of it.' }
        ]
      }
    },

    outro: (c) => {
      const locText = {
        bedroom:    `the bedroom, your sheets`,
        kitchen:    `the kitchen — you end up on the table, every ordinary surface made completely different`,
        livingroom: `the living room — the rug, the couch, the walls`,
        shower:     `the shower, steam filling the air, the water long gone cold`
      };
      const dinnerText = {
        he_cooks:     `<p>He cooked for you. Something real, with good wine and candles, and the particular pleasure of watching someone who loves you do a careful thing on your behalf. You ate slowly. He refilled your glass twice. His hand found your knee under the table and stayed there. By the time the plates were cleared neither of you had any interest in dessert.</p>`,
        cook_together: `<p>You cooked together, which took nearly twice as long as it should have because his hands kept finding reasons to be on you. A sauce needed stirring — and so did you. By the time you actually ate, both of you were already half undone.</p>`,
        order_in:     `<p>You ate in bed — takeout containers, a good bottle of something, his leg pressed warm against yours the entire time. The food was almost beside the point. Almost.</p>`,
        skip:         `<p>You skipped dinner entirely. Some hungers are more urgent than others.</p>`
      };
      const warmupText = {
        massage: `<p>He started with a massage — warm oil, the full weight of his hands moving slowly over your back, your thighs, your shoulders. Thirty minutes of it. No agenda. By the time he was done you were so relaxed and so wound up simultaneously that you could have cried. Then he turned you over.</p>`,
        dance:   `<p>He put something slow on and held you against him in the living room — no rush, no agenda, just his arms and the music and the faint warmth of what was coming. By the time he finally walked you to the bedroom, your whole body had already surrendered. The night was easy from there.</p>`,
        kneel:   `<p>You knelt for him first — your choice, your mouth, your hands. You looked up at him the whole time and watched his composure dismantle piece by piece. He let you do it for a long time before he finally pulled you up by the shoulders with both hands, breathing unsteadily. <em>"Enough,"</em> he said, which meant: not enough, I need to be inside you immediately.</p>`,
        tied:    `<p>He tied your wrists before anything else — not tightly, but thoroughly — and left you on the bed while he moved unhurriedly around the room. You lay there listening to him, the anticipation building until it was its own kind of pleasure. He did not touch you for a full half hour. By the time he did, you were entirely his before he had even started.</p>`
      };
      const oralText = {
        receive: `<p>He went down on you first and did not come up until you made him. His full attention, thorough and patient, until you finished against his mouth — and then he kept going until you finished again, because he could, and because he wanted to. By the time he finally came up you were limp and loose and entirely unable to form sentences.</p>`,
        give:    `<p>You took him in your mouth and stayed there until he pulled you back by the hair with an unsteady sound that you will think about for a long time. He looked down at you with an expression that was equal parts gratitude and desperation. <em>"Not yet,"</em> he said. He meant it for himself.</p>`,
        both:    `<p>He went first, thorough and unhurried, until you came against his tongue. Then you returned it completely — your mouth, your hands, all of it — until he had to pull back before losing control. Neither of you could wait any longer. You were past waiting.</p>`,
        none:    `<p>No preamble. You were both already so ready that nothing else was necessary or possible.</p>`
      };
      const posText = {
        missionary: `<p>He laid you down and took you face to face — his full weight, your face between his hands, the two of you looking directly at each other the entire time. He did not look away. He watched every expression you made with the complete attention of someone who has been waiting for this specific thing.</p>`,
        doggy:      `<p>He turned you over and took you from behind — hands at your hips, then in your hair, then his arm across your chest pulling you back against him. His mouth was at your ear the entire time. He spoke to you in a low continuous voice. You stopped being able to respond with words.</p>`,
        riding:     `<p>You climbed on top and took the pace into your own hands. His were everywhere — your hips, your chest, your face. He let you control it and controlled everything else. When he finally took over, gripping your hips and setting his own pace, you were grateful and wrecked and entirely his.</p>`,
        wall:       `<p>He took you against the wall — lifted you, held you there with your legs around him, his face close enough that you were breathing the same air. There was nowhere to go. You did not want to go anywhere. The sounds you made echoed off the walls and neither of you cared.</p>`
      };
      const finishText = {
        inside:    `<p>He finished inside you — deep and fully, the warmth of it spreading, and he stayed there after, his forehead against yours, the two of you breathing together in the quiet that followed. <em>"God,"</em> he said into your hair. Just that. It was enough.</p>`,
        mouth:     `<p>He pulled out and you took him in your mouth — and looked up at him the entire time. You swallowed every drop, slowly, deliberately, watching his face do something extraordinary. He reached down and held your face in his hands for a long moment after. <em>"Perfect,"</em> he said. <em>"You are so perfect."</em></p>`,
        face:      `<p>He finished on your face — you looked up at him, eyes open, and let him, and the expression he made was something you intend to remember for a very long time. He brushed his thumb across your cheek afterward, slow and possessive. He looked at you like you had just given him something extraordinary. You had.</p>`,
        ass:       `<p>He took his time opening you — slow, careful, thorough — and then took you exactly how he wanted. He finished inside you and held himself there, his arm across your chest, his mouth at your ear. The feeling of him stayed with you for hours. You were glad of it.</p>`,
        chest:     `<p>He finished on your chest — watched it land across your skin and then ran two fingers through it slowly, spreading it deliberately, his eyes moving between the evidence of himself and your face. <em>"Mine,"</em> he said. Not possessively. Reverently.</p>`,
        his_choice: `<p>He did not tell you where. You found out at the last possible moment, when he was already there, and the not knowing had been so much of the pleasure that the knowing — when it came — was nearly overwhelming. You will not describe it here. You already know.</p>`
      };

      const loc = locText[c.location] || locText.bedroom;
      return `
        <p>It happens in ${loc}.</p>
        ${dinnerText[c.dinner] || dinnerText.skip}
        ${warmupText[c.warmup] || warmupText.massage}
        ${oralText[c.oral] || oralText.none}
        ${posText[c.position] || posText.missionary}
        ${finishText[c.finish] || finishText.inside}
        <p>Afterward — in the long, dissolved, extraordinary afterward — you lie together without speaking for a long time. He draws something on your arm with one finger. A letter. Your name.</p>
        <p><em>"That was the story,"</em> he says.</p>
        <p>You consider this. <em>"Was it fiction?"</em></p>
        <p>He thinks about it the way he thinks about things — seriously, without rushing. <em>"No,"</em> he says. <em>"I don't think it was."</em></p>
        <p>He kisses your temple and pulls you closer. Outside, the world is doing whatever it does. In here: the warmth of him, the peace of having been known completely, and the particular safety of someone who has been fully claimed and found the experience not diminishing but enlarging.</p>
        <p><em>"Same time next month?"</em></p>
        <p>You don't answer in words. He takes that as a yes.</p>
      `;
    },

    closing: null
  }

];
